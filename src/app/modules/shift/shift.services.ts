import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import { errorLogger } from '../../shared/logger';
import { anyPatternOccursOnDate, normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import {
    activeWorkerFilter,
    assertWorkersEligible,
    filterEligibleWorkers,
} from '../worker/worker.eligibility.util';
import { Worker } from '../worker/worker.model';
import chatServices from '../chat/chat.services';
import { haversineDistanceMeters } from './geo.util';
import { findWorkerConflictOnDate } from './shift.availability.services';
import {
    ConflictReason,
    IAssignedWorker,
    IShift,
    IShiftAssignedWorker,
} from './shift.interface';
import { photoAiConfig } from '../photo_ai/photo_ai.config';
import { PhotoAiService } from '../photo_ai/photo_ai.service';
import { Shift } from './shift.model';
import {
    buildAdditionalTaskEntriesForDay,
    buildShiftSnapshot,
    recomputeTaskCompletion,
    roomsWithDueTasks,
    tasksOccurringOnDate,
} from './shift.snapshot.util';
import { attachWorkerNames, ensureActivePlan, FULL_WEEKDAY_NAMES, getShiftOrThrow, maybeAutoCompleteShift, roundToTwoDecimals } from './shift.shared.util';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: number }).code === MONGO_DUPLICATE_KEY_ERROR;

/**
 * Loads the existing Shift for (planId, date), or creates one snapshotted
 * from the plan's current state. Throws if the plan doesn't occur on this
 * date. Race-safe: the loser of a concurrent create just refetches the winner.
 */
const getOrCreateBareShift = async (
    planId: string | Types.ObjectId,
    date: Date
): Promise<IShift & { _id: Types.ObjectId }> => {
    const day = normalizeToUTCDateOnly(date);

    const existing = await Shift.findOne({ cleaning_plan: planId, date: day });
    if (existing) return existing;

    const plan = await ensureActivePlan(planId);
    if (!plan.is_active) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Cannot schedule a shift for an inactive cleaning plan'
        );
    }

    const snapshot = await buildShiftSnapshot(plan);
    const dueTasks = tasksOccurringOnDate(snapshot, day);
    if (!dueTasks.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This cleaning plan has no occurrence on the given date'
        );
    }

    const additional = await buildAdditionalTaskEntriesForDay(plan._id, day);
    const dueTasksDurationMinutes = dueTasks.reduce(
        (sum, t) => sum + t.duration_minutes,
        0
    );

    try {
        return await Shift.create({
            cleaning_plan: plan._id,
            date: day,
            // Placeholder — assignWorkersToShift sets the real schedule right after.
            date_time: day,
            end_time: day,
            location: snapshot.location,
            rooms: roomsWithDueTasks(snapshot.rooms, dueTasks),
            tasks: [...dueTasks, ...additional.tasks],
            duration_minutes: dueTasksDurationMinutes + additional.durationMinutes,
            assigned_workers: [],
            status: 'upcoming',
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            // Lost the race — use the winner's document.
            const winner = await Shift.findOne({ cleaning_plan: planId, date: day });
            if (winner) return winner;
        }
        throw error;
    }
};

/**
 * The staffing action: schedules a crew for a due date, and also how a
 * manager swaps the crew mid-shift (no-show replaced, worker pulled sick).
 * Every call after the first MERGES against the existing crew — a worker
 * already on the list keeps their check-in/out state (only role changes);
 * dropping and re-adding never corrupts attendance or pay. Only newly added
 * workers get (re-)validated for eligibility/conflicts. The start/end time
 * only applies while the shift is still 'upcoming' — once it's started, the
 * schedule is locked so pay math can't shift under an already-working crew.
 */
export const assignWorkersToShift = async (
    managerId: string,
    planId: string,
    date: Date,
    assignedWorkers: IAssignedWorker[],
    startTime: Date,
    endTime: Date,
    force: boolean
) => {
    if (!(endTime > startTime)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'end_time must be after start_time');
    }

    const shift = await getOrCreateBareShift(planId, date);
    const shiftHasStarted = shift.status === 'in_progress' || shift.status === 'completed';

    const existingByWorkerId = new Map(
        shift.assigned_workers.map((aw) => [aw.worker.toString(), aw])
    );

    // Only genuinely new workers need (re-)validating.
    const newlyAddedWorkers = assignedWorkers.filter(
        (aw) => !existingByWorkerId.has(aw.worker.toString())
    );

    if (newlyAddedWorkers.length) {
        await assertWorkersEligible(newlyAddedWorkers.map((aw) => aw.worker));
    }

    // Once started, conflict-check against the real committed window, not the caller's params.
    const effectiveStartTime = shiftHasStarted ? shift.date_time : startTime;
    const effectiveEndTime = shiftHasStarted ? shift.end_time : endTime;
    const effectiveDurationMinutes = Math.round(
        (effectiveEndTime.getTime() - effectiveStartTime.getTime()) / 60_000
    );

    const conflictEntries = new Map<
        string,
        { conflicting_plan_id: Types.ObjectId; reason: string }
    >();
    for (const aw of newlyAddedWorkers) {
        const conflict = await findWorkerConflictOnDate(
            aw.worker,
            shift.date,
            effectiveStartTime,
            effectiveDurationMinutes,
            { shiftId: shift._id }
        );
        if (conflict) conflictEntries.set(aw.worker.toString(), conflict);
    }

    if (conflictEntries.size && !force) {
        throw new AppError(
            httpStatus.CONFLICT,
            'One or more workers have a scheduling conflict. Pass force=true to assign anyway.',
            '',
            {
                conflicts: Array.from(conflictEntries.entries()).map(
                    ([workerId, c]) => ({
                        worker: workerId,
                        reason: c.reason,
                        conflicting_plan_id: c.conflicting_plan_id,
                    })
                ),
            }
        );
    }

    const previousWorkerIds = [...existingByWorkerId.keys()];

    const nextAssignedWorkers = assignedWorkers.map((aw) => {
        const workerIdStr = aw.worker.toString();
        const existing = existingByWorkerId.get(workerIdStr);

        if (existing) {
            // Attendance state is never rewritten by a roster edit — only role is editable.
            return {
                worker: existing.worker,
                role: aw.role,
                assigned_with_conflict: existing.assigned_with_conflict,
                check_in_at: existing.check_in_at ?? null,
                check_in_coordinates: existing.check_in_coordinates ?? null,
                check_out_at: existing.check_out_at ?? null,
                check_out_coordinates: existing.check_out_coordinates ?? null,
            };
        }

        return {
            worker: aw.worker,
            role: aw.role,
            assigned_with_conflict: conflictEntries.has(workerIdStr),
            check_in_at: null,
            check_in_coordinates: null,
            check_out_at: null,
            check_out_coordinates: null,
        };
    });

    const result = await Shift.findByIdAndUpdate(
        shift._id,
        {
            assigned_workers: nextAssignedWorkers,
            last_updated_by: managerId,
            ...(!shiftHasStarted && { date_time: startTime, end_time: endTime }),
            // A cancelled shift getting a crew again means it's back on.
            ...(shift.status === 'cancelled' && { status: 'upcoming' }),
        },
        { new: true, runValidators: true }
    );
    if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Shift not found');

    const newWorkerIds = result.assigned_workers.map((aw) => aw.worker.toString());
    const addedWorkerIds = newWorkerIds.filter((id) => !previousWorkerIds.includes(id));
    const removedWorkerIds = previousWorkerIds.filter((id) => !newWorkerIds.includes(id));

    const plan = await CleaningPlan.findById(planId).select('title').lean();
    const planTitle = plan?.title ?? '';

    if (addedWorkerIds.length) {
        emitAppEvent('shift.worker_assigned', {
            shiftId: result._id.toString(),
            planId,
            title: planTitle,
            addedWorkerIds,
            start_date: result.date_time,
        });
    }
    if (removedWorkerIds.length) {
        emitAppEvent('shift.worker_removed', {
            shiftId: result._id.toString(),
            planId,
            title: planTitle,
            removedWorkerIds,
        });
    }

    // Chat group membership accumulates — never auto-removed when a crew rotates.
    if (addedWorkerIds.length) {
        const currentGroupWorkerIds = await chatServices.getChatGroupWorkerIds(planId);
        const unionWorkerIds = [
            ...new Set([...currentGroupWorkerIds, ...addedWorkerIds]),
        ];
        await chatServices.syncChatGroupWorkers(planId, unionWorkerIds);
    }

    const [resultWithNames] = await attachWorkerNames([result.toObject()]);
    return resultWithNames;
};

export interface EligibleWorkerRow {
    worker: Record<string, unknown>;
    // True if this date's weekday is in the worker's own working_days.
    is_available: boolean;
    is_conflict: boolean;
    conflict_reason: ConflictReason | null;
    conflicting_plan_id: Types.ObjectId | null;
}

/**
 * Worker picker for staffing one due date: every active, eligible worker,
 * annotated with weekday availability and whether this window would
 * double-book them. Pure preview — nothing written, nothing blocked here.
 */
export const listEligibleWorkersForShift = async (
    planId: string,
    date: Date,
    startTime: Date,
    endTime: Date
): Promise<EligibleWorkerRow[]> => {
    if (!(endTime > startTime)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'end_time must be after start_time');
    }

    const day = normalizeToUTCDateOnly(date);
    const plan = await ensureActivePlan(planId);
    const snapshot = await buildShiftSnapshot(plan);
    if (!anyPatternOccursOnDate(snapshot.patterns, day)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This cleaning plan has no occurrence on the given date'
        );
    }

    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60_000);
    const weekdayName = FULL_WEEKDAY_NAMES[day.getUTCDay()];

    // Excludes this shift itself — reassigning a worker to it is never a conflict.
    const existingShift = await Shift.findOne({ cleaning_plan: planId, date: day })
        .select('_id')
        .lean();

    const allWorkers = await Worker.find(activeWorkerFilter).lean();
    const eligibleWorkers = await filterEligibleWorkers(allWorkers);

    const results: EligibleWorkerRow[] = [];
    for (const worker of eligibleWorkers) {
        const workingDays = worker.working_days ?? [];
        const isAvailable = workingDays.includes(weekdayName);

        const conflict = await findWorkerConflictOnDate(
            worker._id,
            day,
            startTime,
            durationMinutes,
            { shiftId: existingShift?._id }
        );

        results.push({
            worker,
            is_available: isAvailable,
            is_conflict: !!conflict,
            conflict_reason: conflict?.reason ?? null,
            conflicting_plan_id: conflict?.conflicting_plan_id ?? null,
        });
    }
    return results;
};

export const updateShiftStatus = async (
    managerId: string,
    planId: string,
    date: Date,
    status: IShift['status']
) => {
    const shift = await getShiftOrThrow(planId, date);
    const result = await Shift.findByIdAndUpdate(
        shift._id,
        { status, last_updated_by: managerId },
        { new: true, runValidators: true }
    );
    return result;
};

/**
 * Perceptual hashes to check a new photo against, split by strictness: only
 * an exact match across days means a reused file (same room photographed
 * daily is naturally near-identical), but within one shift even a near-match
 * means the same photo was submitted for two requirements.
 */
const collectRoomPhotoHashes = async (
    roomId: Types.ObjectId | null | undefined,
    shiftId: Types.ObjectId
): Promise<{ sameShift: string[]; otherShifts: string[] }> => {
    const sameShift: string[] = [];
    const otherShifts: string[] = [];

    const current = await Shift.findById(shiftId)
        .select('tasks.photo_requirements.phash')
        .lean();
    for (const task of current?.tasks ?? []) {
        for (const requirement of task.photo_requirements ?? []) {
            if (requirement.phash) sameShift.push(requirement.phash);
        }
    }

    if (!roomId) return { sameShift, otherShifts };

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 60);

    const shifts = await Shift.find({
        _id: { $ne: shiftId },
        date: { $gte: since },
        'tasks.room': roomId,
    })
        .select('tasks.room tasks.photo_requirements.phash')
        .lean();

    for (const shift of shifts) {
        for (const task of shift.tasks ?? []) {
            if (task.room?.toString() !== roomId.toString()) continue;
            for (const requirement of task.photo_requirements ?? []) {
                if (requirement.phash) otherShifts.push(requirement.phash);
            }
        }
    }
    return { sameShift, otherShifts };
};

/**
 * Writes an evaluation result onto one photo requirement. Runs after the
 * response has been sent, so a failure here is logged and dropped rather than
 * surfaced — the task is already complete either way.
 */
const saveAiFields = async (
    shiftId: Types.ObjectId,
    taskId: string,
    title: string,
    result: Awaited<ReturnType<typeof PhotoAiService.evaluatePhoto>>
) => {
    const fields = PhotoAiService.aiResultToFields(result);
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        update[`tasks.$[t].photo_requirements.$[p].${key}`] = value;
    }

    await Shift.updateOne(
        { _id: shiftId },
        { $set: update },
        {
            arrayFilters: [
                { 't.task': new Types.ObjectId(taskId) },
                { 'p.title': title },
            ],
        }
    );
};

/**
 * Records a worker's photo submission for one task. is_completed recomputes
 * automatically from photo requirements — no manual complete step for
 * photo-required tasks. Non-photo tasks use markShiftTaskComplete instead.
 */
export const uploadShiftTaskPhoto = async (
    workerId: string,
    planId: string,
    date: Date,
    taskId: string,
    title: string,
    photoUrl: string
) => {
    const shift = await getShiftOrThrow(planId, date);

    const isAssigned = shift.assigned_workers.some(
        (aw) => aw.worker.toString() === workerId
    );
    if (!isAssigned) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You are not assigned to this shift'
        );
    }

    const taskIndex = shift.tasks.findIndex((t) => t.task.toString() === taskId);
    if (taskIndex === -1) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found on this shift');
    }
    const requirementExists = shift.tasks[taskIndex].photo_requirements.some(
        (p) => p.title === title
    );
    if (!requirementExists) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Unknown photo requirement "${title}" for this task`
        );
    }

    const requirement = shift.tasks[taskIndex].photo_requirements.find(
        (p) => p.title === title
    );
    const attempts = (requirement?.attempt_count ?? 0) + 1;

    // Photos already accepted for this room, so a resubmitted one is caught.
    const reuseCandidates = await collectRoomPhotoHashes(
        shift.tasks[taskIndex].room,
        shift._id
    );

    const gate = await PhotoAiService.checkPhotoByUrl(photoUrl, reuseCandidates);

    // After max_attempts, accept anyway (flagged) so a worker isn't stranded on site.
    const forced =
        gate.status === 'rejected' &&
        attempts >= photoAiConfig.gate.max_attempts;

    if (gate.status === 'rejected' && !forced) {
        await Shift.updateOne(
            { _id: shift._id },
            {
                $set: {
                    'tasks.$[t].photo_requirements.$[p].attempt_count': attempts,
                    'tasks.$[t].photo_requirements.$[p].gate_status': 'rejected',
                    'tasks.$[t].photo_requirements.$[p].gate_reason': gate.reason,
                    'tasks.$[t].photo_requirements.$[p].gate_metrics': gate.metrics,
                },
            },
            {
                arrayFilters: [
                    { 't.task': new Types.ObjectId(taskId) },
                    { 'p.title': title },
                ],
            }
        );
        throw new AppError(
            httpStatus.BAD_REQUEST,
            gate.reason ?? 'Photo could not be accepted. Please retake.'
        );
    }

    // Targeted write — safe under concurrent uploads to other requirements on this shift.
    await Shift.updateOne(
        { _id: shift._id },
        {
            $set: {
                'tasks.$[t].photo_requirements.$[p].photo_url': photoUrl,
                'tasks.$[t].photo_requirements.$[p].is_uploaded': true,
                'tasks.$[t].photo_requirements.$[p].attempt_count': attempts,
                'tasks.$[t].photo_requirements.$[p].forced_accept': forced,
                'tasks.$[t].photo_requirements.$[p].gate_status': gate.status,
                'tasks.$[t].photo_requirements.$[p].gate_reason': gate.reason ?? null,
                'tasks.$[t].photo_requirements.$[p].gate_metrics': gate.metrics,
                'tasks.$[t].photo_requirements.$[p].phash': gate.phash,
                'tasks.$[t].photo_requirements.$[p].ai_status': 'pending',
            },
        },
        {
            arrayFilters: [
                { 't.task': new Types.ObjectId(taskId) },
                { 'p.title': title },
            ],
        }
    );

    // Recomputed from a fresh read, not assumed from this single write.
    const refreshed = await Shift.findById(shift._id);
    if (!refreshed) throw new AppError(httpStatus.NOT_FOUND, 'Shift not found');

    const refreshedIndex = refreshed.tasks.findIndex(
        (t) => t.task.toString() === taskId
    );
    const updatedTask = recomputeTaskCompletion(refreshed.tasks[refreshedIndex]);
    if (updatedTask.is_completed !== refreshed.tasks[refreshedIndex].is_completed) {
        await Shift.updateOne(
            { _id: shift._id, 'tasks.task': taskId },
            {
                $set: {
                    'tasks.$.is_completed': updatedTask.is_completed,
                    'tasks.$.completed_at': updatedTask.completed_at,
                },
            }
        );
    }

    await maybeAutoCompleteShift(shift._id);

    // Not awaited — only adds flags for the manager's review queue.
    const roomId = shift.tasks[taskIndex].room?.toString();
    const room = shift.rooms.find((r) => r.room.toString() === roomId);
    void PhotoAiService.evaluatePhoto({
        photo_url: photoUrl,
        requirement: {
            title,
            description: requirement?.description,
            reference_image_url: requirement?.reference_image_url,
        },
        context: {
            room_name: room?.name,
            room_type: room?.room_type,
            task_name: shift.tasks[taskIndex].name,
        },
    })
        .then((result) => saveAiFields(shift._id, taskId, title, result))
        .catch(() => undefined);

    return Shift.findById(shift._id);
};

export const markShiftTaskComplete = async (
    workerId: string,
    planId: string,
    date: Date,
    taskId: string
) => {
    const shift = await getShiftOrThrow(planId, date);

    const isAssigned = shift.assigned_workers.some(
        (aw) => aw.worker.toString() === workerId
    );
    if (!isAssigned) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You are not assigned to this shift'
        );
    }

    const task = shift.tasks.find((t) => t.task.toString() === taskId);
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found on this shift');
    }
    if (task.is_photo_required) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This task requires photo(s) — upload the required photo(s) to complete it'
        );
    }
    if (task.is_completed) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Task is already completed');
    }

    await Shift.updateOne(
        { _id: shift._id, 'tasks.task': taskId },
        {
            $set: {
                'tasks.$.is_completed': true,
                'tasks.$.completed_at': new Date(),
            },
        }
    );

    await maybeAutoCompleteShift(shift._id);

    return Shift.findById(shift._id);
};

const GEOFENCE_RADIUS_METERS = 50;

// Shared lookup + eligibility check for check-in/check-out.
const findAssignedShiftOrThrow = async (
    workerId: string,
    planId: string,
    date: Date
) => {
    const shift = await getShiftOrThrow(planId, date);
    const workerIndex = shift.assigned_workers.findIndex(
        (aw) => aw.worker.toString() === workerId
    );
    if (workerIndex === -1) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You are not assigned to this shift'
        );
    }
    return { shift, workerIndex };
};

// Validates GPS against the shift's location snapshot; fails closed if no coordinates are configured.
const assertWithinGeofence = (
    shift: { location: { coordinates: { coordinates: [number, number] } | null } },
    coordinates: [number, number]
) => {
    if (!shift.location.coordinates) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This location has no GPS coordinates configured; check-in cannot be validated'
        );
    }
    const distance = haversineDistanceMeters(
        coordinates,
        shift.location.coordinates.coordinates
    );
    if (distance > GEOFENCE_RADIUS_METERS) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `You must be within ${GEOFENCE_RADIUS_METERS}m of the location to check in (currently ${Math.round(distance)}m away)`
        );
    }
};

export const checkInToShift = async (
    workerId: string,
    planId: string,
    date: Date,
    coordinates: [number, number]
) => {
    const { shift, workerIndex } = await findAssignedShiftOrThrow(workerId, planId, date);
    assertWithinGeofence(shift, coordinates);

    if (shift.assigned_workers[workerIndex].check_in_at) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already checked in for this shift');
    }

    // $elemMatch makes "not already checked in" part of the atomic write, not just the read above.
    const checkedInAt = new Date();
    const result = await Shift.findOneAndUpdate(
        {
            _id: shift._id,
            assigned_workers: { $elemMatch: { worker: workerId, check_in_at: null } },
        },
        {
            $set: {
                'assigned_workers.$.check_in_at': checkedInAt,
                'assigned_workers.$.check_in_coordinates': coordinates,
            },
        },
        { new: true }
    );
    if (!result) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already checked in for this shift');
    }

    emitAppEvent('shift.checked_in', {
        shiftId: shift._id.toString(),
        planId,
        workerId,
        at: checkedInAt,
    });

    // First check-in moves the shift out of 'upcoming'; the status filter keeps this race-safe and one-way.
    if (result.status === 'upcoming') {
        const updated = await Shift.findOneAndUpdate(
            { _id: shift._id, status: 'upcoming' },
            { $set: { status: 'in_progress' } },
            { new: true }
        );
        if (updated) return updated;
    }
    return result;
};

/** Each worker is paid the lesser of their actual clocked time and their even split of the shift's scheduled hours. */
const settlePayForWorkers = async (
    shift: { _id: Types.ObjectId; duration_minutes: number },
    workersWhoWorked: IShiftAssignedWorker[],
    session: mongoose.ClientSession
) => {
    const scheduledShareHours = shift.duration_minutes / workersWhoWorked.length / 60;

    const workerIds = workersWhoWorked.map((aw) => aw.worker);
    const workerDocs = await Worker.find({ _id: { $in: workerIds } })
        .select('hourly_rate')
        .session(session);
    const rateById = new Map(
        workerDocs.map((w) => [w._id.toString(), w.hourly_rate])
    );

    const bulkOps = workersWhoWorked.flatMap((aw) => {
        const workerIdStr = aw.worker.toString();
        const hourlyRate = rateById.get(workerIdStr);
        if (hourlyRate === undefined) {
            // Worker record vanished mid-shift — skip paying a nonexistent account.
            errorLogger.warn(
                `settlePayForWorkers: worker ${workerIdStr} missing at settlement for shift ${shift._id.toString()}, skipped`
            );
            return [];
        }
        const actualHours = Math.max(
            0,
            ((aw.check_out_at as Date).getTime() - (aw.check_in_at as Date).getTime()) /
                3_600_000
        );
        const payHours = Math.min(actualHours, scheduledShareHours);
        const earnedAmount = roundToTwoDecimals(payHours * hourlyRate);
        return [
            {
                updateOne: {
                    filter: { _id: aw.worker },
                    update: {
                        $inc: {
                            total_earning: earnedAmount,
                            pending_amount: earnedAmount,
                        },
                    },
                },
            },
        ];
    });

    if (bulkOps.length) {
        await Worker.bulkWrite(bulkOps, { session });
    }
};

/**
 * Marks one worker checked out, and settles pay for the crew if that was
 * the last checkout pending. Shared by checkOutFromShift and the
 * auto-checkout cron — safe either way, since each worker's check_out_at
 * only ever transitions null -> set once.
 */
export const closeOutWorkerAndMaybeSettle = async (
    shiftId: Types.ObjectId,
    workerId: Types.ObjectId | string,
    checkOutAt: Date,
    coordinates: [number, number] | null,
    session: mongoose.ClientSession
) => {
    const result = await Shift.findOneAndUpdate(
        {
            _id: shiftId,
            assigned_workers: {
                $elemMatch: {
                    worker: workerId,
                    check_in_at: { $ne: null },
                    check_out_at: null,
                },
            },
        },
        {
            $set: {
                'assigned_workers.$.check_out_at': checkOutAt,
                'assigned_workers.$.check_out_coordinates': coordinates,
            },
        },
        { new: true, session }
    );
    if (!result) return null;

    // No-shows don't count toward crew size or block settlement.
    const workersWhoWorked = result.assigned_workers.filter((aw) => aw.check_in_at);
    const everyoneSettled = workersWhoWorked.every((aw) => aw.check_out_at);

    if (everyoneSettled && workersWhoWorked.length) {
        await settlePayForWorkers(result, workersWhoWorked, session);
    }

    return result;
};

/**
 * A worker leaving the shift. Anyone but the last one out can leave any
 * time; the last one is gated on every task actually being done, so the
 * crew can't walk off mid-work. Pay settles once, when the last checkout lands.
 */
export const checkOutFromShift = async (
    workerId: string,
    planId: string,
    date: Date,
    coordinates: [number, number]
) => {
    const { shift, workerIndex } = await findAssignedShiftOrThrow(workerId, planId, date);
    assertWithinGeofence(shift, coordinates);

    const checkInAt = shift.assigned_workers[workerIndex].check_in_at;
    if (!checkInAt) {
        throw new AppError(httpStatus.BAD_REQUEST, 'You have not checked in for this shift yet');
    }
    if (shift.assigned_workers[workerIndex].check_out_at) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already checked out for this shift');
    }

    const otherWorkersStillOnSite = shift.assigned_workers.filter(
        (aw, idx) => idx !== workerIndex && aw.check_in_at && !aw.check_out_at
    );
    const isLastWorkerOut = otherWorkersStillOnSite.length === 0;

    if (isLastWorkerOut && shift.status !== 'completed') {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'All tasks must be completed before the last worker can check out'
        );
    }

    const checkOutAt = new Date();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await closeOutWorkerAndMaybeSettle(
            shift._id,
            workerId,
            checkOutAt,
            coordinates,
            session
        );
        if (!result) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Already checked out for this shift');
        }

        await session.commitTransaction();
        session.endSession();

        emitAppEvent('shift.checked_out', {
            shiftId: shift._id.toString(),
            planId,
            workerId,
            at: checkOutAt,
        });

        return result;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// ─── Re-exports: other modules import these by name from this file's old location ───
export {
    resyncTodayShiftTasksForRoomsIfDue,
    resyncTodayShiftRoomsIfDue,
    reconcileFutureShiftsForTaskChange,
    cancelUpcomingShiftsAcrossPlans,
    resyncFutureShiftTasksForRoomsIfDue,
    resyncTodayShiftLocationIfDue,
    resyncTodayShiftAdditionalTaskIfDue,
    AffectedFutureShift,
    FutureTaskPatternChange,
} from './shift.resync.services';
export { TRosterView, getPlanGroupedRosterFromDB } from './shift.roster.services';

import {
    cancelUpcomingShiftsAcrossPlans,
    reconcileFutureShiftsForTaskChange,
    resyncFutureShiftTasksForRoomsIfDue,
    resyncTodayShiftAdditionalTaskIfDue,
    resyncTodayShiftRoomsIfDue,
    resyncTodayShiftTasksForRoomsIfDue,
} from './shift.resync.services';
import {
    getActiveShiftForWorker,
    getClientLiveShiftsFromDB,
    getNextShiftForWorker,
    getShiftForDate,
    getSingleLiveShiftFromDB,
    getTodayLiveShiftMetaFromDB,
    getTodayLiveShiftsFromDB,
    getWorkerTodayMetaFromDB,
    listShiftsInRange,
    listWorkerShiftsForDate,
} from './shift.query.services';
import { bulkAssignWorkerToShifts, previewBulkAssignForWorker } from './shift.bulk_assign.services';
import {
    getManagerReportFromDB,
    getWorkerAttendanceSummaryFromDB,
    getWorkerPerformanceFromDB,
    getWorkersAttendanceListFromDB,
    getWorkersAttendanceSummaryFromDB,
} from './shift.report.services';
import { getManagerPlanRosterFromDB, getShiftRosterFromDB } from './shift.roster.services';
import { getPhotoReviewListFromDB, setPhotoVerdict } from './shift.photo_review.services';

const shiftServices = {
    listWorkerShiftsForDate,
    resyncTodayShiftTasksForRoomsIfDue,
    resyncTodayShiftRoomsIfDue,
    resyncTodayShiftAdditionalTaskIfDue,
    reconcileFutureShiftsForTaskChange,
    resyncFutureShiftTasksForRoomsIfDue,
    cancelUpcomingShiftsAcrossPlans,
    getShiftForDate,
    listShiftsInRange,
    getClientLiveShiftsFromDB,
    getActiveShiftForWorker,
    getWorkerTodayMetaFromDB,
    getNextShiftForWorker,
    getTodayLiveShiftMetaFromDB,
    getManagerReportFromDB,
    getTodayLiveShiftsFromDB,
    getSingleLiveShiftFromDB,
    getWorkerPerformanceFromDB,
    getWorkersAttendanceSummaryFromDB,
    getWorkersAttendanceListFromDB,
    getWorkerAttendanceSummaryFromDB,
    getShiftRosterFromDB,
    getManagerPlanRosterFromDB,
    getPhotoReviewListFromDB,
    setPhotoVerdict,
    assignWorkersToShift,
    listEligibleWorkersForShift,
    previewBulkAssignForWorker,
    bulkAssignWorkerToShifts,
    updateShiftStatus,
    uploadShiftTaskPhoto,
    markShiftTaskComplete,
    checkInToShift,
    checkOutFromShift,
};

export default shiftServices;
