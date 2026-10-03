import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    anyPatternOccursOnDate,
    combineDateWithTimeOfDay,
    laterOf,
    normalizeToUTCDateOnly,
    occursOnDate,
    RecurrencePattern,
    taskToPattern,
} from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Client } from '../client/client.model';
import { Location } from '../location/location.model';
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import { TTaskFrequency } from '../task/task.interface';
import {
    activeWorkerFilter,
    assertWorkersEligible,
    filterEligibleWorkers,
} from '../worker/worker.eligibility.util';
import { WorkerType } from '../worker/worker.constant';
import { Worker } from '../worker/worker.model';
import { IssueReport } from '../issue_report/issue_report.model';
import chatServices from '../chat/chat.services';
import { haversineDistanceMeters } from './geo.util';
import { findWorkerConflictOnDate } from './shift.availability.services';
import {
    ConflictReason,
    IAssignedWorker,
    IShift,
    IShiftAssignedWorker,
    IShiftTask,
} from './shift.interface';
import { photoAiConfig } from '../photo_ai/photo_ai.config';
import { PhotoAiService } from '../photo_ai/photo_ai.service';
import { Shift } from './shift.model';
import {
    buildAdditionalTaskEntriesForDay,
    buildShiftSnapshot,
    pickRandom,
    recomputeTaskCompletion,
    roomsWithDueTasks,
    tasksOccurringOnDate,
    toShiftTaskFromAdditionalTask,
} from './shift.snapshot.util';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: number }).code === MONGO_DUPLICATE_KEY_ERROR;

// end_time is required now, but shifts from before the field existed have none — fall back to date_time + duration.
const resolveShiftEndTime = (shift: {
    date_time: Date;
    end_time?: Date | null;
    duration_minutes: number;
}): Date => shift.end_time ?? new Date(shift.date_time.getTime() + shift.duration_minutes * 60_000);

// .lean() — every caller only reads plan fields (location, rooms, is_active,
// _id) to build a snapshot or check state; none of them save this doc back.
const ensureActivePlan = async (planId: string | Types.ObjectId) => {
    const plan = await CleaningPlan.findById(planId).lean();
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

// A Shift only exists once a manager has staffed it — nothing auto-materializes it.
const getShiftOrThrow = async (
    planId: string | Types.ObjectId,
    date: Date
): Promise<IShift & { _id: Types.ObjectId }> => {
    const day = normalizeToUTCDateOnly(date);
    const shift = await Shift.findOne({ cleaning_plan: planId, date: day });
    if (!shift) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'No shift has been scheduled for this date yet'
        );
    }
    return shift;
};

/**
 * Resyncs a shift's tasks[] against the plan's current active tasks.
 * Reconciles photo_requirements against the template so uploads already
 * made survive the sync, topping up or trimming the random selection to
 * match required_photo_count.
 */
const computeSyncedShiftTasks = async (
    shift: Pick<IShift, 'tasks' | 'date'>,
    taskIds: (Types.ObjectId | string)[]
) => {
    const allActiveTasks = await Task.find({
        _id: { $in: taskIds },
        is_active: true,
    })
        .select(
            'room name duration_minutes is_photo_required photo_requirements required_photo_count frequency_type days_of_week days_of_month createdAt'
        )
        .lean();
    // Only tasks actually due today belong here — a room mixes daily/weekly/monthly tasks.
    const activeTasks = allActiveTasks.filter((t) =>
        occursOnDate(shift.date, taskToPattern(t, t.createdAt, null))
    );

    // Additional tasks aren't sourced from Task at all — carried forward unchanged.
    const planTaskEntries = shift.tasks.filter((t) => t.source !== 'additional_task');
    const additionalTaskEntries = shift.tasks.filter((t) => t.source === 'additional_task');

    const existingByTaskId = new Map(
        planTaskEntries.map((t) => [t.task.toString(), t])
    );

    let changed = activeTasks.length !== planTaskEntries.length;

    const nextTasks = activeTasks.map((t) => {
        const existing = existingByTaskId.get(t._id.toString());

        const pool = t.photo_requirements ?? [];
        const targetCount = t.is_photo_required
            ? Math.min(t.required_photo_count ?? 0, pool.length)
            : 0;

        let photoRequirements: {
            title: string;
            description?: string | null;
            reference_image_url?: string | null;
            photo_url: string | null;
            is_uploaded: boolean;
        }[];

        if (!t.is_photo_required) {
            photoRequirements = [];
        } else if (!existing || !existing.is_photo_required) {
            // Brand-new task, or a task just switched to photo-required: fresh random pick.
            photoRequirements = pickRandom(pool, targetCount).map((pr) => ({
                title: pr.title,
                description: pr.description ?? null,
                reference_image_url: pr.reference_image_url ?? null,
                photo_url: null,
                is_uploaded: false,
            }));
        } else {
            const poolByTitle = new Map(pool.map((pr) => [pr.title, pr]));
            // Refresh guidance text from the template; keep this occurrence's own upload state.
            let kept = existing.photo_requirements
                .filter((p) => poolByTitle.has(p.title))
                .map((p) => {
                    const current = poolByTitle.get(p.title)!;
                    return {
                        ...p,
                        description: current.description ?? null,
                        reference_image_url: current.reference_image_url ?? null,
                    };
                });

            if (kept.length > targetCount) {
                const uploaded = kept.filter((p) => p.is_uploaded);
                const notUploaded = kept.filter((p) => !p.is_uploaded);
                kept =
                    uploaded.length >= targetCount
                        ? uploaded.slice(0, targetCount)
                        : [
                              ...uploaded,
                              ...notUploaded.slice(0, targetCount - uploaded.length),
                          ];
            } else if (kept.length < targetCount) {
                const keptTitles = new Set(kept.map((p) => p.title));
                const remainingPool = pool.filter(
                    (pr) => !keptTitles.has(pr.title)
                );
                const additional = pickRandom(
                    remainingPool,
                    targetCount - kept.length
                ).map((pr) => ({
                    title: pr.title,
                    description: pr.description ?? null,
                    reference_image_url: pr.reference_image_url ?? null,
                    photo_url: null,
                    is_uploaded: false,
                }));
                kept = [...kept, ...additional];
            }

            photoRequirements = kept;
        }

        if (!existing) {
            changed = true;
            return {
                task: t._id,
                room: t.room,
                name: t.name,
                duration_minutes: t.duration_minutes ?? 0,
                is_photo_required: t.is_photo_required,
                photo_requirements: photoRequirements,
                is_completed: false,
                completed_at: null,
                source: 'plan_task' as const,
            };
        }

        const isCompleted = t.is_photo_required
            ? photoRequirements.every((p) => p.is_uploaded)
            : existing.is_completed;
        const completedAt =
            isCompleted === existing.is_completed
                ? existing.completed_at
                : isCompleted
                  ? new Date()
                  : null;

        const updated = {
            task: t._id,
            room: t.room,
            name: t.name,
            duration_minutes: t.duration_minutes ?? 0,
            is_photo_required: t.is_photo_required,
            photo_requirements: photoRequirements,
            is_completed: isCompleted,
            completed_at: completedAt,
            source: 'plan_task' as const,
        };

        if (
            existing.name !== updated.name ||
            existing.duration_minutes !== updated.duration_minutes ||
            existing.is_photo_required !== updated.is_photo_required ||
            existing.is_completed !== updated.is_completed ||
            JSON.stringify(existing.photo_requirements) !==
                JSON.stringify(updated.photo_requirements)
        ) {
            changed = true;
        }

        return updated;
    });

    const allTasks = [...nextTasks, ...additionalTaskEntries];
    const durationMinutes = allTasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0),
        0
    );

    return { tasks: allTasks, durationMinutes, changed };
};

/**
 * Syncs today's materialized 'upcoming' shift when a task in its rooms
 * changes — future shifts rebuild live, so only today needs this fixup.
 * Skips in_progress/completed/cancelled shifts.
 */
export const resyncTodayShiftTasksForRoomsIfDue = async (
    roomIds: (Types.ObjectId | string)[]
) => {
    const today = normalizeToUTCDateOnly(new Date());

    const plans = await CleaningPlan.find({
        rooms: { $in: roomIds },
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms tasks')
        .lean();

    for (const plan of plans) {
        const shift = await Shift.findOne({
            cleaning_plan: plan._id,
            date: today,
            status: 'upcoming',
        });
        if (!shift) continue;

        const { tasks, durationMinutes, changed } = await computeSyncedShiftTasks(
            shift,
            plan.tasks ?? []
        );
        if (!changed) continue;

        await Shift.updateOne(
            { _id: shift._id, status: 'upcoming' },
            { $set: { tasks, duration_minutes: durationMinutes } }
        );

        await maybeAutoCompleteShift(shift._id);
    }
};

/**
 * Same fixup as resyncTodayShiftTasksForRoomsIfDue, but also handles a
 * brand-new room added to the plan, which that one alone would miss.
 */
export const resyncTodayShiftRoomsIfDue = async (
    planId: Types.ObjectId | string,
    roomIds: (Types.ObjectId | string)[],
    taskIds: (Types.ObjectId | string)[]
) => {
    const today = normalizeToUTCDateOnly(new Date());
    const shift = await Shift.findOne({
        cleaning_plan: planId,
        date: today,
        status: 'upcoming',
    });
    if (!shift) return null;

    const rooms = await Room.find({ _id: { $in: roomIds } })
        .select('name room_type')
        .lean();
    const allRooms = rooms.map((r) => ({
        room: r._id,
        name: r.name,
        room_type: r.room_type,
    }));

    const { tasks, durationMinutes } = await computeSyncedShiftTasks(shift, taskIds);
    const nextRooms = roomsWithDueTasks(allRooms, tasks);

    await Shift.updateOne(
        { _id: shift._id, status: 'upcoming' },
        { $set: { rooms: nextRooms, tasks, duration_minutes: durationMinutes } }
    );

    await maybeAutoCompleteShift(shift._id);

    return null;
};

export interface AffectedFutureShift {
    shift_id: string;
    plan_id: string;
    plan_title: string;
    date: Date;
    assigned_worker_ids: string[];
}

/** The task's would-be recurrence fields after a pending edit; null means the
 * task is being deleted/deactivated (removed from the room's active set). */
export interface FutureTaskPatternChange {
    frequency_type: TTaskFrequency;
    days_of_week?: string[];
    days_of_month?: number[];
    createdAt: Date;
}

/**
 * A task's schedule edit can make a future shift no longer due, but
 * materialized shifts don't recompute themselves. Unstaffed orphans get
 * deleted; staffed ones need `force` (409 otherwise) and are cancelled,
 * not deleted, with the crew/client notified. Must run before the Task
 * write so a blocked edit leaves nothing mutated.
 */
export const reconcileFutureShiftsForTaskChange = async (
    roomIds: (Types.ObjectId | string)[],
    changedTaskId: Types.ObjectId | string,
    nextPattern: FutureTaskPatternChange | null,
    managerId: string,
    force: boolean
): Promise<void> => {
    const today = normalizeToUTCDateOnly(new Date());

    const plans = await CleaningPlan.find({
        rooms: { $in: roomIds },
        tasks: changedTaskId,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('title client rooms tasks')
        .lean();
    if (!plans.length) return;

    const orphansByPlan = new Map<
        string,
        { plan: (typeof plans)[number]; shifts: (IShift & { _id: Types.ObjectId })[] }
    >();

    for (const plan of plans) {
        const otherTasks = await Task.find({
            _id: { $in: plan.tasks, $ne: changedTaskId },
            is_active: true,
        })
            .select('frequency_type days_of_week days_of_month createdAt')
            .lean();

        const newPatterns: RecurrencePattern[] = otherTasks.map((t) =>
            taskToPattern(t, t.createdAt, null)
        );
        if (nextPattern) {
            newPatterns.push(taskToPattern(nextPattern, nextPattern.createdAt, null));
        }

        const futureShifts = await Shift.find({
            cleaning_plan: plan._id,
            date: { $gt: today },
            status: 'upcoming',
        });

        const orphaned = futureShifts.filter(
            (s) => !anyPatternOccursOnDate(newPatterns, s.date)
        );
        if (orphaned.length) {
            orphansByPlan.set(plan._id.toString(), { plan, shifts: orphaned });
        }
    }
    if (!orphansByPlan.size) return;

    const staffedAffected: AffectedFutureShift[] = [];
    for (const { plan, shifts } of orphansByPlan.values()) {
        for (const shift of shifts) {
            if (shift.assigned_workers.length) {
                staffedAffected.push({
                    shift_id: shift._id.toString(),
                    plan_id: plan._id.toString(),
                    plan_title: plan.title,
                    date: shift.date,
                    assigned_worker_ids: shift.assigned_workers.map((aw) =>
                        aw.worker.toString()
                    ),
                });
            }
        }
    }

    if (staffedAffected.length && !force) {
        throw new AppError(
            httpStatus.CONFLICT,
            'This change removes one or more already-staffed future shifts from the schedule. Pass force=true to proceed — those shifts will be cancelled and the assigned crew/client notified.',
            '',
            { affected_shifts: staffedAffected }
        );
    }

    for (const { plan, shifts } of orphansByPlan.values()) {
        const unstaffed = shifts.filter((s) => !s.assigned_workers.length);
        const staffed = shifts.filter((s) => s.assigned_workers.length);

        if (unstaffed.length) {
            await Shift.deleteMany({ _id: { $in: unstaffed.map((s) => s._id) } });
        }

        for (const shift of staffed) {
            const cancelledWorkerIds = shift.assigned_workers.map((aw) =>
                aw.worker.toString()
            );
            await Shift.updateOne(
                { _id: shift._id, status: 'upcoming' },
                { status: 'cancelled', last_updated_by: managerId }
            );
            emitAppEvent('shift.cancelled', {
                shiftId: shift._id.toString(),
                planId: plan._id.toString(),
                clientId: plan.client.toString(),
                title: plan.title,
                date: shift.date,
                cancelledWorkerIds,
            });
        }
    }
};

export const cancelUpcomingShiftsAcrossPlans = async (
    planIds: (Types.ObjectId | string)[],
    managerId: string,
    session?: mongoose.ClientSession
): Promise<string[]> => {
    if (!planIds.length) return [];

    // Only _id/assigned_workers are read below, so skip the rest of the payload.
    const shifts = await Shift.find({
        cleaning_plan: { $in: planIds },
        status: 'upcoming',
    })
        .select('assigned_workers')
        .session(session ?? null)
        .lean();
    if (!shifts.length) return [];

    const unstaffed = shifts.filter((s) => !s.assigned_workers.length);
    const staffed = shifts.filter((s) => s.assigned_workers.length);

    if (unstaffed.length) {
        await Shift.deleteMany(
            { _id: { $in: unstaffed.map((s) => s._id) } },
            { session }
        );
    }
    if (!staffed.length) return [];

    await Shift.updateMany(
        { _id: { $in: staffed.map((s) => s._id) }, status: 'upcoming' },
        { status: 'cancelled', last_updated_by: managerId },
        { session }
    );

    return [
        ...new Set(
            staffed.flatMap((s) => s.assigned_workers.map((aw) => aw.worker.toString()))
        ),
    ];
};

/**
 * Forward-looking counterpart to resyncTodayShiftTasksForRoomsIfDue, for
 * already-staffed future shifts. Run after reconcileFutureShiftsForTaskChange
 * and after the Task write lands.
 */
export const resyncFutureShiftTasksForRoomsIfDue = async (
    roomIds: (Types.ObjectId | string)[]
) => {
    const today = normalizeToUTCDateOnly(new Date());

    const plans = await CleaningPlan.find({
        rooms: { $in: roomIds },
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms tasks')
        .lean();

    for (const plan of plans) {
        const shifts = await Shift.find({
            cleaning_plan: plan._id,
            date: { $gt: today },
            status: 'upcoming',
        });

        for (const shift of shifts) {
            const { tasks, durationMinutes, changed } = await computeSyncedShiftTasks(
                shift,
                plan.tasks ?? []
            );
            if (!changed) continue;

            await Shift.updateOne(
                { _id: shift._id, status: 'upcoming' },
                { $set: { tasks, duration_minutes: durationMinutes } }
            );
        }
    }
};

/**
 * Re-copies a Location's current name/coordinates into today's materialized
 * shift snapshot — otherwise an address edit wouldn't reach the geofence
 * check until the next midnight cron. Skips shifts already in progress.
 */
export const resyncTodayShiftLocationIfDue = async (
    planId: Types.ObjectId | string
) => {
    const today = normalizeToUTCDateOnly(new Date());
    const shift = await Shift.findOne({
        cleaning_plan: planId,
        date: today,
        status: 'upcoming',
    });
    if (!shift) return;

    const plan = await CleaningPlan.findById(planId).select('location').lean();
    if (!plan) return;

    const location = await Location.findById(plan.location)
        .select('name location')
        .lean();
    if (!location) return;

    await Shift.updateOne(
        { _id: shift._id, status: 'upcoming' },
        {
            $set: {
                'location.name': location.name,
                'location.coordinates': location.location ?? null,
            },
        }
    );
};



export const resyncTodayShiftAdditionalTaskIfDue = async (additionalTask: {
    _id: Types.ObjectId;
    cleaning_plan_id: Types.ObjectId;
    date_time: Date;
    name: string;
    duration_minutes?: number | null;
    is_photo_required: boolean;
    photo_requirements: { title: string }[];
}) => {
    const day = normalizeToUTCDateOnly(additionalTask.date_time);
    const shift = await Shift.findOne({
        cleaning_plan: additionalTask.cleaning_plan_id,
        date: day,
        status: 'upcoming',
    });
    if (!shift) return null;

    const alreadyIncluded = shift.tasks.some(
        (t) =>
            t.source === 'additional_task' &&
            t.task.toString() === additionalTask._id.toString()
    );
    if (alreadyIncluded) return null;

    const shiftTask = toShiftTaskFromAdditionalTask(additionalTask);

    await Shift.updateOne(
        { _id: shift._id, status: 'upcoming' },
        {
            $push: { tasks: shiftTask },
            $inc: { duration_minutes: shiftTask.duration_minutes },
        }
    );

    await maybeAutoCompleteShift(shift._id);

    return null;
};


export const getShiftForDate = async (
    planId: string,
    date: Date,
    requestingWorkerId?: string
) => {
    const day = normalizeToUTCDateOnly(date);
    const existing = await Shift.findOne({ cleaning_plan: planId, date: day }).lean();

    let result: (Record<string, unknown> & { assigned_workers: IAssignedWorker[] }) | null;
    if (existing) {
        result = { ...existing, end_time: resolveShiftEndTime(existing), is_virtual: false };
    } else {
        const plan = await ensureActivePlan(planId);
        const snapshot = await buildShiftSnapshot(plan);
        const dueTasks = tasksOccurringOnDate(snapshot, day);
        result = dueTasks.length
            ? {
                  cleaning_plan: plan._id,
                  date: day,
                  location: snapshot.location,
                  rooms: roomsWithDueTasks(snapshot.rooms, dueTasks),
                  tasks: dueTasks,
                  duration_minutes: dueTasks.reduce(
                      (sum, t) => sum + t.duration_minutes,
                      0
                  ),
                  assigned_workers: [],
                  status: 'unstaffed',
                  is_virtual: true,
              }
            : null;
    }

    if (
        result &&
        requestingWorkerId &&
        !result.assigned_workers.some(
            (aw) => aw.worker.toString() === requestingWorkerId
        )
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You are not assigned to this shift'
        );
    }

    return result;
};

/**
 * Every occurrence of the plan in [from, to]: the materialized shift where
 * one exists, otherwise an unstaffed placeholder for dates the plan is due.
 */
export const listShiftsInRange = async (planId: string, from: Date, to: Date) => {
    const plan = await ensureActivePlan(planId);
    const fromDay = normalizeToUTCDateOnly(from);
    const toDay = normalizeToUTCDateOnly(to);
    if (toDay < fromDay) {
        throw new AppError(httpStatus.BAD_REQUEST, '`to` must not be before `from`');
    }

    const snapshot = await buildShiftSnapshot(plan);

    const existingShifts = await Shift.find({
        cleaning_plan: planId,
        date: { $gte: fromDay, $lte: toDay },
    }).lean();
    const existingByDate = new Map(existingShifts.map((s) => [s.date.toISOString(), s]));

    const results: Array<Record<string, unknown>> = [];
    for (
        let cursor = new Date(fromDay);
        cursor <= toDay;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
        const day = new Date(cursor);
        const existing = existingByDate.get(day.toISOString());
        if (existing) {
            results.push({ ...existing, end_time: resolveShiftEndTime(existing), is_virtual: false });
            continue;
        }
        const dueTasks = tasksOccurringOnDate(snapshot, day);
        if (!dueTasks.length) continue;
        results.push({
            cleaning_plan: plan._id,
            date: day,
            location: snapshot.location,
            rooms: roomsWithDueTasks(snapshot.rooms, dueTasks),
            tasks: dueTasks,
            duration_minutes: dueTasks.reduce((sum, t) => sum + t.duration_minutes, 0),
            assigned_workers: [],
            status: 'unstaffed',
            is_virtual: true,
        });
    }
    return results;
};

// Caps how far a bulk-assign preview/confirm can span, so neither walk is unbounded.
export const MAX_BULK_ASSIGN_RANGE_DAYS = 60;

// A due date with nobody covering it: virtual, cancelled, or an empty crew.
const isUnstaffedGap = (entry: {
    is_virtual: boolean;
    status: string;
    assigned_workers: unknown[];
}): boolean =>
    entry.is_virtual || entry.status === 'cancelled' || entry.assigned_workers.length === 0;

export interface BulkAssignDateEntry {
    date: Date;
    weekday: string;
}

export interface BulkAssignPreviewResult {
    worker_id: string;
    worker_name: string;
    range: { from: Date; to: Date };
    /** Due, unstaffed, and this worker's own working_days covers the weekday — would be assigned on confirm. */
    matching_dates: BulkAssignDateEntry[];
    /** Due and unstaffed, but this worker isn't available that weekday — still needs someone else. */
    other_gap_dates: BulkAssignDateEntry[];
    /** Due dates in range that already have an active crew — left untouched either way. */
    already_covered_count: number;
}

/**
 * Read-only preview for bulk-assign: splits this plan's still-unstaffed
 * dates in [from, to] by whether the worker's own working_days covers them.
 */
export const previewBulkAssignForWorker = async (
    planId: string,
    workerId: string,
    from: Date,
    to: Date
): Promise<BulkAssignPreviewResult> => {
    const fromDay = normalizeToUTCDateOnly(from);
    const toDay = normalizeToUTCDateOnly(to);
    if (toDay < fromDay) {
        throw new AppError(httpStatus.BAD_REQUEST, '`to` must not be before `from`');
    }
    const rangeDays =
        Math.round((toDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > MAX_BULK_ASSIGN_RANGE_DAYS) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Range too large — please select ${MAX_BULK_ASSIGN_RANGE_DAYS} days or fewer`
        );
    }
    if (!mongoose.isValidObjectId(workerId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }

    await assertWorkersEligible([workerId]);
    const worker = await Worker.findById(workerId).select('name working_days').lean();
    if (!worker) {
        throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    }
    const workingDays = new Set(worker.working_days ?? []);

    const shiftEntries = (await listShiftsInRange(planId, fromDay, toDay)) as Array<{
        date: Date;
        is_virtual: boolean;
        status: string;
        assigned_workers: unknown[];
    }>;

    const matching_dates: BulkAssignDateEntry[] = [];
    const other_gap_dates: BulkAssignDateEntry[] = [];
    let already_covered_count = 0;

    for (const entry of shiftEntries) {
        if (!isUnstaffedGap(entry)) {
            already_covered_count += 1;
            continue;
        }
        const weekday = FULL_WEEKDAY_NAMES[entry.date.getUTCDay()];
        const bucket = workingDays.has(weekday) ? matching_dates : other_gap_dates;
        bucket.push({ date: entry.date, weekday });
    }

    return {
        worker_id: workerId,
        worker_name: worker.name,
        range: { from: fromDay, to: toDay },
        matching_dates,
        other_gap_dates,
        already_covered_count,
    };
};

export interface BulkAssignOutcome {
    assigned: string[];
    skipped_already_staffed: string[];
    /** Skipped — worker's already booked elsewhere that day. Retry with force:true to assign anyway. */
    ignored_due_to_conflict: Array<{ date: string; reason: string }>;
    failed: Array<{ date: string; message: string }>;
    counts: {
        assigned: number;
        skipped_already_staffed: number;
        ignored_due_to_conflict: number;
        failed: number;
    };
}

/**
 * Write side of bulk-assign: stages the worker onto every still-unstaffed
 * date, delegating each one to assignWorkersToShift so eligibility checks
 * and notifications behave the same as a single manual assign. Best-effort,
 * not all-or-nothing — a scheduling conflict is skipped (not a failure)
 * unless `force` is set, in which case it's assigned anyway.
 */
export const bulkAssignWorkerToShifts = async (
    managerId: string,
    planId: string,
    workerId: string,
    role: IAssignedWorker['role'],
    dates: Date[],
    startTime: Date,
    endTime: Date,
    force: boolean
): Promise<BulkAssignOutcome> => {
    if (!(endTime > startTime)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'end_time must be after start_time');
    }
    if (dates.length > MAX_BULK_ASSIGN_RANGE_DAYS) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Too many dates — please select ${MAX_BULK_ASSIGN_RANGE_DAYS} or fewer`
        );
    }
    if (!mongoose.isValidObjectId(workerId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }

    const normalizedDates = dates.map((d) => normalizeToUTCDateOnly(d));

    const existingShifts = await Shift.find({
        cleaning_plan: planId,
        date: { $in: normalizedDates },
    })
        .select('date status assigned_workers')
        .lean();
    const coveredDateKeys = new Set(
        existingShifts
            .filter((s) => !isUnstaffedGap({ ...s, is_virtual: false }))
            .map((s) => s.date.toISOString())
    );

    const outcome: Omit<BulkAssignOutcome, 'counts'> = {
        assigned: [],
        skipped_already_staffed: [],
        ignored_due_to_conflict: [],
        failed: [],
    };

    for (const date of normalizedDates) {
        const dateKey = date.toISOString();
        const dateLabel = dateKey.slice(0, 10);

        if (coveredDateKeys.has(dateKey)) {
            outcome.skipped_already_staffed.push(dateLabel);
            continue;
        }

        try {
            await assignWorkersToShift(
                managerId,
                planId,
                date,
                [{ worker: new Types.ObjectId(workerId), role }],
                combineDateWithTimeOfDay(date, startTime),
                combineDateWithTimeOfDay(date, endTime),
                force
            );
            outcome.assigned.push(dateLabel);
        } catch (error) {
            if (error instanceof AppError && error.statusCode === httpStatus.CONFLICT) {
                outcome.ignored_due_to_conflict.push({ date: dateLabel, reason: error.message });
            } else if (error instanceof AppError) {
                outcome.failed.push({ date: dateLabel, message: error.message });
            } else {
                // One bad date (e.g. a DB hiccup) shouldn't fail the whole batch.
                errorLogger.error(
                    `bulkAssignWorkerToShifts: unexpected error assigning ${planId}/${dateLabel}`,
                    error
                );
                outcome.failed.push({
                    date: dateLabel,
                    message: 'Unexpected error while assigning this date — please retry.',
                });
            }
        }
    }

    return {
        ...outcome,
        counts: {
            assigned: outcome.assigned.length,
            skipped_already_staffed: outcome.skipped_already_staffed.length,
            ignored_due_to_conflict: outcome.ignored_due_to_conflict.length,
            failed: outcome.failed.length,
        },
    };
};

/**
 * A worker's shifts for one date — plain query, no virtual projection,
 * since a worker only ever appears on a real staffed shift. Excludes
 * cancelled shifts; feeds both my-shifts and today's meta counts.
 */
export const listWorkerShiftsForDate = async (workerId: string, date: Date) => {
    const day = normalizeToUTCDateOnly(date);
    const shifts = await Shift.find({
        date: day,
        'assigned_workers.worker': workerId,
        status: { $ne: 'cancelled' },
    })
        .sort({ date_time: 1 })
        .lean();
    return shifts.map((shift) => ({
        ...shift,
        end_time: resolveShiftEndTime(shift),
        is_virtual: false,
    }));
};

/**
 * Per-room progress = completed/total tasks in that room; overall progress
 * is the average across rooms, so one large room can't drown out a small one.
 */
const attachProgress = (shift: IShift & { _id: Types.ObjectId }) => {
    const rooms = shift.rooms.map((room) => {
        const roomTasks = shift.tasks.filter(
            (t) => t.room && t.room.toString() === room.room.toString()
        );
        const completedTask = roomTasks.filter((t) => t.is_completed).length;
        const totalTask = roomTasks.length;
        return {
            ...room,
            total_task: totalTask,
            completed_task: completedTask,
            progress_percent: totalTask
                ? Math.round((completedTask / totalTask) * 100)
                : 0,
        };
    });

    const overallProgressPercent = rooms.length
        ? Math.round(
              rooms.reduce((sum, r) => sum + r.progress_percent, 0) / rooms.length
          )
        : 0;

    return {
        ...shift,
        end_time: resolveShiftEndTime(shift),
        rooms,
        total_room: shift.rooms.length,
        completed_room: rooms.filter((r) => r.progress_percent === 100).length,
        total_task: shift.tasks.length,
        overall_progress_percent: overallProgressPercent,
    };
};

/** Client-facing "what's happening now": every in_progress shift across this client's plans, with live progress. */
export const getClientLiveShiftsFromDB = async (clientId: string) => {
    const planIds = await CleaningPlan.find({
        client: clientId,
        is_active: true,
    }).distinct('_id');

    const shifts = await Shift.find({
        cleaning_plan: { $in: planIds },
        status: 'in_progress',
    }).lean();

    return shifts.map((shift) => {
        const { tasks, ...withoutTasks } = attachProgress(shift);
        return withoutTasks;
    });
};


export const getActiveShiftForWorker = async (workerId: string) => {
    const shift = await Shift.findOne({
        status: 'in_progress',
        assigned_workers: {
            $elemMatch: {
                worker: workerId,
                check_in_at: { $ne: null },
                check_out_at: null,
            },
        },
    }).lean();

    if (!shift) return {};
    const { tasks, rooms, assigned_workers, ...rest } = attachProgress(shift);
    const own = assigned_workers.find((aw) => aw.worker.toString() === workerId);
    return { ...rest, check_in_at: own?.check_in_at ?? null };
};


export const getWorkerTodayMetaFromDB = async (workerId: string) => {
    const shifts = await listWorkerShiftsForDate(workerId, new Date());
    const total = shifts.length;
    const completed = shifts.filter((s) => s.status === 'completed').length;
    return {
        total_shift: total,
        completed,
        pending: total - completed,
    };
};


export const getNextShiftForWorker = async (workerId: string) => {
    const now = new Date();

    const materialized = await Shift.findOne({
        'assigned_workers.worker': workerId,
        status: 'upcoming',
        date_time: { $gt: now },
    })
        .sort({ date_time: 1 })
        .lean();

    if (!materialized) return {};
    const { tasks, rooms, assigned_workers, ...rest } = materialized;
    return { ...rest, end_time: resolveShiftEndTime(materialized), is_virtual: false };
};

/**
 * Dashboard-wide "today at a glance" — same for every manager, not scoped
 * to the caller. Only counts already-materialized shifts (the daily cron
 * guarantees today's exist by now). total_absent/total_late are
 * point-in-time: absent = past start, never checked in; late = checked in
 * after the scheduled start. Mutually exclusive, both exclude cancelled shifts.
 */
export const getTodayLiveShiftMetaFromDB = async () => {
    const today = normalizeToUTCDateOnly(new Date());
    const now = new Date();

    const allShifts = await Shift.find({ date: today })
        .select('status date_time assigned_workers')
        .lean();
    const shifts = allShifts.filter((s) => s.status !== 'cancelled');

    const absentWorkers = new Map<string, string>();
    const lateWorkers = new Map<string, string>();
    shifts.forEach((shift) => {
        shift.assigned_workers.forEach((aw) => {
            const workerId = aw.worker.toString();
            if (!aw.check_in_at) {
                if (shift.date_time <= now) absentWorkers.set(workerId, aw.name);
            } else if (aw.check_in_at > shift.date_time) {
                lateWorkers.set(workerId, aw.name);
            }
        });
    });

    const toWorkerRows = (workers: Map<string, string>) =>
        Array.from(workers, ([worker_id, name]) => ({ worker_id, name }));

    return {
        today_total_shift: shifts.length,
        today_total_completed_shift: shifts.filter(
            (s) => s.status === 'completed'
        ).length,
        today_total_in_progress_shift: shifts.filter(
            (s) => s.status === 'in_progress'
        ).length,
        today_total_pending_shift: shifts.filter(
            (s) => s.status === 'upcoming'
        ).length,
        total_absent: absentWorkers.size,
        total_late: lateWorkers.size,
        absent_workers: toWorkerRows(absentWorkers),
        late_workers: toWorkerRows(lateWorkers),
    };
};

// ─── Manager report (week/month/quarter/year) ───────────────────────────────

export const REPORT_PERIODS = ['week', 'month', 'quarter', 'year'] as const;
export type TReportPeriod = (typeof REPORT_PERIODS)[number];

// "This week/month/quarter/year" as an inclusive UTC [from, to] range. Week starts Monday.
const getReportDateRange = (period: TReportPeriod, now: Date) => {
    const today = normalizeToUTCDateOnly(now);

    if (period === 'week') {
        const dayOfWeek = today.getUTCDay(); // 0=Sun..6=Sat
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() + diffToMonday);
        const to = new Date(from);
        to.setUTCDate(to.getUTCDate() + 6);
        return { from, to };
    }

    if (period === 'month') {
        const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
        return { from, to };
    }

    if (period === 'quarter') {
        const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
        const from = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth, 1));
        const to = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth + 3, 0));
        return { from, to };
    }

    // year
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
    return { from, to };
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Bucket size scales with range length so every period renders a readable number of bars. */
const buildShiftTrendBuckets = (
    period: TReportPeriod,
    from: Date,
    to: Date,
    shiftDates: Date[]
) => {
    if (period === 'week') {
        return WEEKDAY_LABELS.map((label, index) => {
            const date = new Date(from);
            date.setUTCDate(date.getUTCDate() + index);
            const count = shiftDates.filter((d) => d.getTime() === date.getTime()).length;
            return { label, date: date.toISOString().slice(0, 10), total_shift: count };
        });
    }

    if (period === 'month') {
        const daysInMonth = to.getUTCDate();
        return Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), i + 1));
            const count = shiftDates.filter((d) => d.getTime() === date.getTime()).length;
            return { label: String(i + 1), date: date.toISOString().slice(0, 10), total_shift: count };
        });
    }

    if (period === 'quarter') {
        const buckets: { label: string; date: string; total_shift: number }[] = [];
        let cursor = new Date(from);
        let weekIndex = 1;
        while (cursor <= to) {
            const bucketEnd = new Date(cursor);
            bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
            const cappedEnd = bucketEnd > to ? to : bucketEnd;
            const count = shiftDates.filter(
                (d) => d >= cursor && d <= cappedEnd
            ).length;
            buckets.push({
                label: `Week ${weekIndex}`,
                date: cursor.toISOString().slice(0, 10),
                total_shift: count,
            });
            cursor = new Date(cappedEnd);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            weekIndex += 1;
        }
        return buckets;
    }

    // year
    return MONTH_LABELS.map((label, monthIndex) => {
        const count = shiftDates.filter(
            (d) => d.getUTCFullYear() === from.getUTCFullYear() && d.getUTCMonth() === monthIndex
        ).length;
        return { label, total_shift: count };
    });
};

/** Dashboard report: shift + issue-report totals for the period, plus a trend chart and status breakdown. */
export const getManagerReportFromDB = async (period: TReportPeriod) => {
    const now = new Date();
    const { from, to } = getReportDateRange(period, now);
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const [shifts, issueReports] = await Promise.all([
        Shift.find({ date: { $gte: from, $lt: toExclusive } })
            .select('date')
            .lean(),
        IssueReport.find({ createdAt: { $gte: from, $lt: toExclusive } })
            .select('status')
            .lean(),
    ]);

    const shiftDates = shifts.map((s) => s.date);

    const issueReportStatus = {
        PENDING: issueReports.filter((r) => r.status === 'PENDING').length,
        IN_PROGRESS: issueReports.filter((r) => r.status === 'IN_PROGRESS').length,
        RESOLVED: issueReports.filter((r) => r.status === 'RESOLVED').length,
    };

    return {
        period,
        range: {
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
        },
        summary: {
            total_shift: shifts.length,
            total_issue_report: issueReports.length,
        },
        shift_trends: buildShiftTrendBuckets(period, from, to, shiftDates),
        issue_report_status: issueReportStatus,
    };
};

const MAX_PAGE_SIZE = 100;

const parseObjectIdQueryParam = (
    value: unknown,
    fieldName: string
): Types.ObjectId | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${fieldName}`);
    }
    return new Types.ObjectId(value);
};

// Batch-resolves plan/client info for a set of shifts in two queries total, not one per shift.
const attachPlanAndClient = async <T extends { cleaning_plan: Types.ObjectId }>(
    shifts: T[]
) => {
    if (!shifts.length) return [];

    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const plans = await CleaningPlan.find({ _id: { $in: planIds } })
        .select('title client')
        .lean();

    const clientIds = [...new Set(plans.map((p) => p.client.toString()))];
    const clients = clientIds.length
        ? await Client.find({ _id: { $in: clientIds } })
              .select('name')
              .lean()
        : [];
    const clientById = new Map(clients.map((c) => [c._id.toString(), c]));

    const planById = new Map(
        plans.map((p) => [
            p._id.toString(),
            {
                _id: p._id,
                title: p.title,
                client: clientById.get(p.client.toString()) ?? null,
            },
        ])
    );

    return shifts.map((shift) => {
        const plan = planById.get(shift.cleaning_plan.toString());
        const { cleaning_plan, ...rest } = shift;
        return {
            ...rest,
            cleaning_plan: plan
                ? { _id: plan._id, title: plan.title }
                : { _id: cleaning_plan, title: null },
            client: plan?.client
                ? { _id: plan.client._id, name: plan.client.name }
                : null,
        };
    });
};

// Allowlisted so a caller can't force a sort on an unindexed path.
const TODAY_LIVE_SHIFTS_SORTABLE_FIELDS = new Set([
    'date_time',
    'status',
    'createdAt',
    'updatedAt',
]);

// 'cancelled' is deliberately not a valid filter value here — today's live shifts never includes it.
const SHIFT_STATUSES = new Set<IShift['status']>([
    'upcoming',
    'in_progress',
    'completed',
]);

/** Manager-facing today's-shifts list, system-wide, filterable by location/client. Room detail lives on the single-shift endpoint. */
export const getTodayLiveShiftsFromDB = async (
    query: Record<string, unknown>
) => {
    const today = normalizeToUTCDateOnly(new Date());

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const sort = query.sort as string | undefined;
    const sortOrder = sort?.startsWith('-') ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'date_time';
    if (!TODAY_LIVE_SHIFTS_SORTABLE_FIELDS.has(sortField)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Invalid sort field. Allowed: ${[...TODAY_LIVE_SHIFTS_SORTABLE_FIELDS].join(', ')}`
        );
    }

    const match: Record<string, unknown> = { date: today, status: { $ne: 'cancelled' } };

    const locationId = parseObjectIdQueryParam(query.location, 'location');
    if (locationId) {
        match['location.location'] = locationId;
    }

    const clientId = parseObjectIdQueryParam(query.client, 'client');
    if (clientId) {
        const planIds = await CleaningPlan.find({ client: clientId }).distinct('_id');
        match.cleaning_plan = { $in: planIds };
    }

    if (query.status !== undefined && query.status !== '') {
        if (!SHIFT_STATUSES.has(query.status as IShift['status'])) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Invalid status. Allowed: ${[...SHIFT_STATUSES].join(', ')}`
            );
        }
        match.status = query.status;
    }

    const [shifts, total] = await Promise.all([
        Shift.find(match)
            // _id tiebreaker keeps pagination stable when sortField ties.
            .sort({ [sortField]: sortOrder, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Shift.countDocuments(match),
    ]);

    const withProgress = shifts.map((shift) => {
        const { tasks, rooms, assigned_workers, ...rest } = attachProgress(shift);
        return rest;
    });
    const result = await attachPlanAndClient(withProgress);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

/** One shift's full detail — tasks, rooms with progress, crew, plan/client context. */
export const getSingleLiveShiftFromDB = async (id: string) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid shift ID');
    }

    const shift = await Shift.findById(id).lean();
    if (!shift) {
        throw new AppError(httpStatus.NOT_FOUND, 'Shift not found');
    }

    const [result] = await attachPlanAndClient([attachProgress(shift)]);
    return result;
};

/**
 * One worker's monthly performance, from materialized shifts only (the
 * source of truth for check-in/check-out data). late = checked in after the
 * scheduled start; absent = past date, status not cancelled, never checked in.
 */
export const getWorkerPerformanceFromDB = async (
    workerId: string,
    month?: number,
    year?: number
) => {
    const now = new Date();
    const targetYear = year ?? now.getUTCFullYear();
    const targetMonth = month ?? now.getUTCMonth() + 1; // 1-12
    if (targetMonth < 1 || targetMonth > 12) {
        throw new AppError(httpStatus.BAD_REQUEST, 'month must be between 1 and 12');
    }

    const monthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth, 0)); // last day of the month
    const today = normalizeToUTCDateOnly(now);

    // A worker only ever appears on a real, staffed Shift.
    const materialized = await Shift.find({
        'assigned_workers.worker': workerId,
        date: { $gte: monthStart, $lte: monthEnd },
    }).lean();

    let completed = 0;
    let inProgress = 0;
    let upcomingMaterialized = 0;
    let late = 0;
    let absent = 0;
    let workedMs = 0;

    for (const shift of materialized) {
        if (shift.status === 'completed') completed += 1;
        if (shift.status === 'in_progress') inProgress += 1;
        if (shift.status === 'upcoming') upcomingMaterialized += 1;

        const entry = shift.assigned_workers.find(
            (aw) => aw.worker.toString() === workerId
        );
        if (!entry) continue;

        if (entry.check_in_at && entry.check_in_at > shift.date_time) {
            late += 1;
        }

        if (shift.date < today && shift.status !== 'cancelled' && !entry.check_in_at) {
            absent += 1;
        }

        if (entry.check_in_at && entry.check_out_at) {
            workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
        }
    }

    const photo_quality = summarisePhotoQuality(materialized);

    return {
        month: targetMonth,
        year: targetYear,
        total_shift_on_this_month: materialized.length,
        total_completed_on_this_month: completed,
        total_in_progress: inProgress,
        total_upcoming_on_this_month: upcomingMaterialized,
        total_late_on_this_month: late,
        total_absent_on_this_month: absent,
        total_work_on_this_month: roundToTwoDecimals(workedMs / 3_600_000),
        photo_quality,
    };
};

export interface IWorkerPhotoQuality {
    total_photos: number;
    approved: number;
    rejected: number;
    /** Share of decided photos that were approved, or null if none were. */
    approval_rate: number | null;
    /** Decided by a person rather than automatically. */
    reviewed_by_manager: number;
    /** Gate rejections the worker had to retake past, across all photos. */
    retakes: number;
    /** Accepted only because the retake limit was reached. */
    forced_accepts: number;
}

/**
 * Photo quality for one worker. Uses a manager's verdict where there is
 * one, the automatic decision otherwise — but reports both counts
 * separately, since an all-machine approval rate means something different.
 */
const summarisePhotoQuality = (
    shifts: { tasks?: IShiftTask[] }[]
): IWorkerPhotoQuality => {
    let total = 0;
    let approved = 0;
    let rejected = 0;
    let reviewedByManager = 0;
    let retakes = 0;
    let forcedAccepts = 0;

    for (const shift of shifts) {
        for (const task of shift.tasks ?? []) {
            for (const requirement of task.photo_requirements ?? []) {
                if (!requirement.is_uploaded) continue;
                total += 1;

                if (requirement.attempt_count && requirement.attempt_count > 1) {
                    retakes += requirement.attempt_count - 1;
                }
                if (requirement.forced_accept) forcedAccepts += 1;

                const verdict =
                    requirement.manager_verdict ?? requirement.auto_decision;
                if (requirement.manager_verdict) reviewedByManager += 1;
                if (verdict === 'approved') approved += 1;
                if (verdict === 'rejected') rejected += 1;
            }
        }
    }

    const decided = approved + rejected;
    return {
        total_photos: total,
        approved,
        rejected,
        approval_rate: decided ? roundToTwoDecimals((approved / decided) * 100) : null,
        reviewed_by_manager: reviewedByManager,
        retakes,
        forced_accepts: forcedAccepts,
    };
};

export type TAttendanceSummaryPeriod = 'today' | 'weekly' | 'monthly';

/** [start, end) UTC bounds for the requested period, anchored on `now`. Weekly runs Monday-Sunday. */
const getAttendanceSummaryPeriodRange = (
    period: TAttendanceSummaryPeriod,
    now: Date
): { start: Date; end: Date } => {
    const today = normalizeToUTCDateOnly(now);

    if (period === 'today') {
        const end = new Date(today);
        end.setUTCDate(end.getUTCDate() + 1);
        return { start: today, end };
    }

    if (period === 'weekly') {
        const dayIndex = today.getUTCDay(); // 0 = Sun .. 6 = Sat
        const diffToMonday = dayIndex === 0 ? 6 : dayIndex - 1;
        const start = new Date(today);
        start.setUTCDate(start.getUTCDate() - diffToMonday);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        return { start, end };
    }

    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return { start, end };
};

/**
 * Attendance summary across all workers for the period. Each assigned-worker
 * entry counts separately. punctuality_percentage is on-time check-ins over
 * total check-ins (on-time = at or before the scheduled start, no grace).
 */
export const getWorkersAttendanceSummaryFromDB = async (
    period: TAttendanceSummaryPeriod
) => {
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);

    const shifts = await Shift.find({
        date: { $gte: start, $lt: end },
    }).lean();

    let completedShifts = 0;
    let workedMs = 0;
    let checkedInCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    for (const shift of shifts) {
        if (shift.status === 'completed') completedShifts += 1;

        for (const entry of shift.assigned_workers) {
            if (entry.check_in_at && entry.check_out_at) {
                workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
            }

            if (entry.check_in_at) {
                checkedInCount += 1;
                if (entry.check_in_at > shift.date_time) {
                    lateCount += 1;
                } else {
                    onTimeCount += 1;
                }
            }
        }
    }

    const punctualityPercentage =
        checkedInCount > 0
            ? roundToTwoDecimals((onTimeCount / checkedInCount) * 100)
            : 0;

    return {
        period,
        start_date: start,
        end_date: end,
        total_hours: roundToTwoDecimals(workedMs / 3_600_000),
        completed_shifts: completedShifts,
        punctuality_percentage: punctualityPercentage,
        on_time_check_ins: onTimeCount,
        late_check_ins: lateCount,
    };
};

/**
 * Per-worker attendance rows for the period, filterable by name/worker type.
 * One row per matching active worker, even with zero shifts (an all-0 row).
 */
export const getWorkersAttendanceListFromDB = async (
    period: TAttendanceSummaryPeriod,
    searchTerm?: string,
    workerType?: WorkerType
) => {
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);

    const workerFilter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (workerType) workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }

    const workers = await Worker.find(workerFilter)
        .select('name worker_type')
        .lean();

    if (!workers.length) return [];

    const workerIds = new Set(workers.map((w) => w._id.toString()));

    const shifts = await Shift.find({
        date: { $gte: start, $lt: end },
        'assigned_workers.worker': { $in: workers.map((w) => w._id) },
    }).lean();

    const statsByWorker = new Map<
        string,
        { hoursWorkedMs: number; totalShifts: number; lateDays: number }
    >();

    for (const shift of shifts) {
        for (const entry of shift.assigned_workers) {
            const workerId = entry.worker.toString();
            if (!workerIds.has(workerId)) continue;

            const stats = statsByWorker.get(workerId) ?? {
                hoursWorkedMs: 0,
                totalShifts: 0,
                lateDays: 0,
            };
            stats.totalShifts += 1;
            if (entry.check_in_at && entry.check_out_at) {
                stats.hoursWorkedMs +=
                    entry.check_out_at.getTime() - entry.check_in_at.getTime();
            }
            if (entry.check_in_at && entry.check_in_at > shift.date_time) {
                stats.lateDays += 1;
            }
            statsByWorker.set(workerId, stats);
        }
    }

    return workers.map((worker) => {
        const stats = statsByWorker.get(worker._id.toString());
        return {
            worker_id: worker._id,
            name: worker.name,
            worker_type: worker.worker_type,
            hours_worked: roundToTwoDecimals((stats?.hoursWorkedMs ?? 0) / 3_600_000),
            total_shifts: stats?.totalShifts ?? 0,
            late_days: stats?.lateDays ?? 0,
        };
    });
};

/** Same as getWorkersAttendanceSummaryFromDB, scoped to one worker — powers the profile's Attendance tab. */
export const getWorkerAttendanceSummaryFromDB = async (
    workerId: string,
    period: TAttendanceSummaryPeriod
) => {
    if (!mongoose.isObjectIdOrHexString(workerId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }
    const worker = await Worker.findOne({
        _id: workerId,
        isDeleted: { $ne: true },
    }).select('_id').lean();
    if (!worker) throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');

    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);

    const shifts = await Shift.find({
        date: { $gte: start, $lt: end },
        'assigned_workers.worker': workerId,
    })
        .select('date_time status assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
        .lean();

    let completedShifts = 0;
    let workedMs = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    for (const shift of shifts) {
        const entry = shift.assigned_workers.find(
            (aw) => aw.worker.toString() === workerId
        );
        if (!entry) continue;

        if (shift.status === 'completed') completedShifts += 1;

        if (entry.check_in_at && entry.check_out_at) {
            workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
        }

        if (entry.check_in_at) {
            if (entry.check_in_at > shift.date_time) {
                lateCount += 1;
            } else {
                onTimeCount += 1;
            }
        }
    }

    const checkedInCount = onTimeCount + lateCount;
    const punctualityPercentage =
        checkedInCount > 0
            ? roundToTwoDecimals((onTimeCount / checkedInCount) * 100)
            : 0;

    return {
        period,
        start_date: start,
        end_date: end,
        total_hours: roundToTwoDecimals(workedMs / 3_600_000),
        completed_shifts: completedShifts,
        punctuality_percentage: punctualityPercentage,
        total_check_ins: checkedInCount,
        on_time_check_ins: onTimeCount,
        late_check_ins: lateCount,
    };
};

export type TRosterView = 'day' | 'week' | 'month';

interface RosterQueryParams {
    view: TRosterView;
    date?: string; // YYYY-MM-DD — anchors 'day'/'week'
    year?: number; // anchors 'month'
    month?: number; // 1-12 — anchors 'month'
    searchTerm?: string;
    workerType?: WorkerType;
    client?: string;
    location?: string;
    page?: number;
    limit?: number;
}

interface RosterShiftEntry {
    shift_id: string | null;
    is_virtual: boolean;
    plan_id: string;
    location_name: string;
    start_time: Date;
    duration_minutes: number;
    end_time: Date;
    status: IShift['status'];
}

/** [start, end) UTC bounds for the roster view. Week runs Sunday-Saturday (matches the roster UI). */
export const getRosterDateRange = (
    view: TRosterView,
    date: string | undefined,
    year: number | undefined,
    month: number | undefined
): { start: Date; end: Date } => {
    if (view === 'month') {
        const now = new Date();
        const targetYear = year ?? now.getUTCFullYear();
        const targetMonth = month ?? now.getUTCMonth() + 1;
        if (targetMonth < 1 || targetMonth > 12) {
            throw new AppError(httpStatus.BAD_REQUEST, 'month must be between 1 and 12');
        }
        return {
            start: new Date(Date.UTC(targetYear, targetMonth - 1, 1)),
            end: new Date(Date.UTC(targetYear, targetMonth, 1)),
        };
    }

    let anchor: Date;
    if (date) {
        anchor = normalizeToUTCDateOnly(new Date(date));
        if (Number.isNaN(anchor.getTime())) {
            throw new AppError(httpStatus.BAD_REQUEST, `Invalid date: ${date}`);
        }
    } else {
        anchor = normalizeToUTCDateOnly(new Date());
    }

    if (view === 'day') {
        const end = new Date(anchor);
        end.setUTCDate(end.getUTCDate() + 1);
        return { start: anchor, end };
    }

    // week: Sunday-Saturday containing `anchor`
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() - anchor.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
};

/**
 * Shift Roster page: one page of active workers (filterable by name/type)
 * with their staffed shifts per date in the range. client/location narrow
 * to workers with a matching shift, and their calendar cells show only
 * matching shifts too. Pagination runs on the Worker query first (one
 * `$facet` for page + total), then Shifts are fetched only for that page.
 */
export const getShiftRosterFromDB = async (params: RosterQueryParams) => {
    const { view, date, year, month, searchTerm, workerType, client, location } = params;
    const { start, end } = getRosterDateRange(view, date, year, month);

    const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 20) || 20));

    const shiftFilter: Record<string, unknown> = {
        date: { $gte: start, $lt: end },
        status: { $ne: 'cancelled' },
    };
    if (location !== undefined) {
        if (!mongoose.isValidObjectId(location)) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Invalid location ID');
        }
        shiftFilter['location.location'] = new Types.ObjectId(location);
    }
    if (client !== undefined) {
        if (!mongoose.isValidObjectId(client)) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Invalid client ID');
        }
        const planIds = await CleaningPlan.find({ client }).distinct('_id');
        shiftFilter.cleaning_plan = { $in: planIds };
    }
    const filteringByClientOrLocation = location !== undefined || client !== undefined;

    const workerFilter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (workerType) workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }
    if (filteringByClientOrLocation) {
        const matchingWorkerIds = await Shift.find(shiftFilter).distinct(
            'assigned_workers.worker'
        );
        workerFilter._id = { $in: matchingWorkerIds };
    }

    const [facet] = await Worker.aggregate<{
        data: { _id: Types.ObjectId; name: string; worker_type: WorkerType }[];
        totalCount: { total: number }[];
    }>([
        { $match: workerFilter },
        { $sort: { name: 1, _id: 1 } },
        {
            $facet: {
                data: [
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    { $project: { name: 1, worker_type: 1 } },
                ],
                totalCount: [{ $count: 'total' }],
            },
        },
    ]);

    const workers = facet?.data ?? [];
    const totalWorkers = facet?.totalCount?.[0]?.total ?? 0;
    const totalPage = totalWorkers ? Math.ceil(totalWorkers / limit) : 0;

    const dateKeys: string[] = [];
    for (
        let cursor = new Date(start);
        cursor < end;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
        dateKeys.push(new Date(cursor).toISOString().slice(0, 10));
    }

    if (!workers.length) {
        return {
            view,
            start_date: start,
            end_date: end,
            meta: { page, limit, total: totalWorkers, totalPage, total_shifts: 0 },
            workers: [],
        };
    }

    const workerIds = workers.map((w) => w._id);
    const workerIdSet = new Set(workerIds.map((id) => id.toString()));

    const materializedShifts = await Shift.find({
        ...shiftFilter,
        'assigned_workers.worker': { $in: workerIds },
    }).lean();

    // workerId -> dateKey -> entries
    const shiftsByWorkerDate = new Map<string, Map<string, RosterShiftEntry[]>>();
    const addEntry = (workerId: string, dateKey: string, entry: RosterShiftEntry) => {
        let byDate = shiftsByWorkerDate.get(workerId);
        if (!byDate) {
            byDate = new Map();
            shiftsByWorkerDate.set(workerId, byDate);
        }
        const list = byDate.get(dateKey);
        if (list) list.push(entry);
        else byDate.set(dateKey, [entry]);
    };

    let totalShifts = 0;

    for (const shift of materializedShifts) {
        const matchingWorkerIds = shift.assigned_workers
            .map((aw) => aw.worker.toString())
            .filter((id) => workerIdSet.has(id));
        if (!matchingWorkerIds.length) continue;

        const dateKey = shift.date.toISOString().slice(0, 10);
        const entry: RosterShiftEntry = {
            shift_id: shift._id.toString(),
            is_virtual: false,
            plan_id: shift.cleaning_plan.toString(),
            location_name: shift.location?.name ?? '',
            start_time: shift.date_time,
            duration_minutes: shift.duration_minutes,
            end_time: resolveShiftEndTime(shift),
            status: shift.status,
        };
        totalShifts += 1;
        for (const workerId of matchingWorkerIds) {
            addEntry(workerId, dateKey, entry);
        }
    }

    const workerRows = workers.map((worker) => {
        const workerId = worker._id.toString();
        const byDate = shiftsByWorkerDate.get(workerId);
        const shiftsByDate: Record<string, RosterShiftEntry[]> = {};
        let totalShiftsForWorker = 0;
        let totalMinutesForWorker = 0;
        for (const dateKey of dateKeys) {
            const entries = byDate?.get(dateKey) ?? [];
            shiftsByDate[dateKey] = entries;
            totalShiftsForWorker += entries.length;
            totalMinutesForWorker += entries.reduce(
                (sum, e) => sum + e.duration_minutes,
                0
            );
        }
        return {
            worker_id: worker._id,
            name: worker.name,
            worker_type: worker.worker_type,
            total_shifts_in_range: totalShiftsForWorker,
            total_hours_in_range: roundToTwoDecimals(totalMinutesForWorker / 60),
            shifts_by_date: shiftsByDate,
        };
    });

    return {
        view,
        start_date: start,
        end_date: end,
        meta: {
            page,
            limit,
            total: totalWorkers,
            totalPage,
            total_shifts: totalShifts,
        },
        workers: workerRows,
    };
};

export interface PlanRosterShiftEntry {
    date: string;
    shift_id: string | null;
    is_virtual: boolean;
    status: string;
    // null until a manager staffs this due date.
    start_time: Date | null;
    end_time: Date | null;
    duration_minutes: number;
    rooms: { total: number; completed: number };
    tasks: { total: number; completed: number };
    assigned_workers: Array<{ worker_id: string; name: string; role: string }>;
}

export interface PlanGroupedRosterParams {
    view: TRosterView;
    date?: string;
    year?: number;
    month?: number;
    page?: number;
    limit?: number;
}

/**
 * Roster grouped by plan: shared by the client-facing and manager-facing
 * roster endpoints (via `planFilter`). For each matching plan, every due
 * date gets either the real staffed shift or an unstaffed placeholder.
 */
export const getPlanGroupedRosterFromDB = async (
    planFilter: Record<string, unknown>,
    params: PlanGroupedRosterParams
) => {
    const { view, date, year, month } = params;
    const { start, end } = getRosterDateRange(view, date, year, month);

    const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 10) || 10));

    const [totalPlans, plans] = await Promise.all([
        CleaningPlan.countDocuments(planFilter),
        CleaningPlan.find(planFilter)
            .select('title location rooms tasks createdAt')
            .sort({ title: 1, _id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
    ]);

    const totalPage = totalPlans ? Math.ceil(totalPlans / limit) : 0;

    if (!plans.length) {
        return {
            view,
            start_date: start,
            end_date: end,
            meta: { page, limit, total: totalPlans, totalPage, total_shifts: 0 },
            cleaning_plans: [],
        };
    }

    const planIds = plans.map((p) => p._id);
    const allTaskIds = [
        ...new Set(plans.flatMap((p) => (p.tasks ?? []).map((t) => t.toString()))),
    ];
    const allLocationIds = [...new Set(plans.map((p) => p.location.toString()))];

    const [tasks, locations, materializedShifts] = await Promise.all([
        Task.find({ _id: { $in: allTaskIds }, is_active: true })
            .select('room frequency_type days_of_week days_of_month duration_minutes createdAt')
            .lean(),
        Location.find({ _id: { $in: allLocationIds } }).select('name').lean(),
        Shift.find({
            cleaning_plan: { $in: planIds },
            date: { $gte: start, $lt: end },
        }).lean(),
    ]);

    const tasksById = new Map(tasks.map((t) => [t._id.toString(), t]));
    const locationNameById = new Map(locations.map((l) => [l._id.toString(), l.name]));
    const materializedByPlanDate = new Map(
        materializedShifts.map((s) => [`${s.cleaning_plan.toString()}|${s.date.toISOString()}`, s])
    );

    let totalShifts = 0;

    const cleaning_plans = plans.map((plan) => {
        const planIdStr = plan._id.toString();
        const planTasks = (plan.tasks ?? [])
            .map((id) => tasksById.get(id.toString()))
            .filter((t): t is NonNullable<typeof t> => !!t);
        // Anchored on whichever is later, the task's or the plan's own createdAt.
        const patterns = planTasks.map((t) =>
            taskToPattern(t, laterOf(t.createdAt, plan.createdAt), null)
        );
        const locationName = locationNameById.get(plan.location.toString()) ?? '';

        const shifts: PlanRosterShiftEntry[] = [];
        let totalMinutes = 0;

        for (
            let cursor = new Date(start);
            cursor < end;
            cursor.setUTCDate(cursor.getUTCDate() + 1)
        ) {
            const day = new Date(cursor);
            const dateKey = day.toISOString().slice(0, 10);
            const materialized = materializedByPlanDate.get(`${planIdStr}|${day.toISOString()}`);

            if (materialized) {
                const planTasksInShift = (materialized.tasks || []).filter(
                    (t) => t.source === 'plan_task' && t.room
                );
                const roomIds = (materialized.rooms || []).map((r) => r.room.toString());
                let completedRooms = 0;
                for (const roomId of roomIds) {
                    const tasksInRoom = planTasksInShift.filter((t) => t.room?.toString() === roomId);
                    if (tasksInRoom.length > 0 && tasksInRoom.every((t) => t.is_completed)) {
                        completedRooms += 1;
                    }
                }
                const totalTasksInShift = (materialized.tasks || []).length;
                const completedTasksInShift = (materialized.tasks || []).filter((t) => t.is_completed).length;

                shifts.push({
                    date: dateKey,
                    shift_id: materialized._id.toString(),
                    is_virtual: false,
                    status: materialized.status,
                    start_time: materialized.date_time,
                    end_time: resolveShiftEndTime(materialized),
                    duration_minutes: materialized.duration_minutes,
                    rooms: { total: roomIds.length, completed: completedRooms },
                    tasks: { total: totalTasksInShift, completed: completedTasksInShift },
                    assigned_workers: (materialized.assigned_workers || []).map((w) => ({
                        worker_id: w.worker?.toString() || '',
                        name: w.name,
                        role: w.role,
                    })),
                });
                totalMinutes += materialized.duration_minutes;
                totalShifts += 1;
                continue;
            }

            if (!planTasks.length) continue;
            const dueTasksForDay = planTasks.filter((_, i) =>
                occursOnDate(day, patterns[i])
            );
            if (!dueTasksForDay.length) continue;

            const dueRoomIds = new Set(dueTasksForDay.map((t) => t.room.toString()));

            // Due, but not yet staffed — no time or crew to show.
            const virtualDurationMinutes = dueTasksForDay.reduce(
                (sum, t) => sum + (t.duration_minutes || 0),
                0
            );

            shifts.push({
                date: dateKey,
                shift_id: null,
                is_virtual: true,
                status: 'unstaffed',
                start_time: null,
                end_time: null,
                duration_minutes: virtualDurationMinutes,
                rooms: { total: dueRoomIds.size, completed: 0 },
                tasks: { total: dueTasksForDay.length, completed: 0 },
                assigned_workers: [],
            });
            totalMinutes += virtualDurationMinutes;
            totalShifts += 1;
        }

        // A gap the manager still needs to staff: virtual, cancelled, or crew-less.
        const unassignedShiftCount = shifts.filter(
            (s) => s.is_virtual || s.status === 'cancelled' || s.assigned_workers.length === 0
        ).length;

        return {
            plan_id: planIdStr,
            plan_title: plan.title,
            location_name: locationName,
            total_shifts_in_range: shifts.length,
            unassigned_shift_count: unassignedShiftCount,
            total_hours_in_range: roundToTwoDecimals(totalMinutes / 60),
            shifts,
        };
    });

    return {
        view,
        start_date: start,
        end_date: end,
        meta: { page, limit, total: totalPlans, totalPage, total_shifts: totalShifts },
        cleaning_plans,
    };
};

export interface ManagerPlanRosterParams extends PlanGroupedRosterParams {
    client?: string;
    location?: string;
    searchTerm?: string;
}

/** System-wide plan-grouped roster — same shape as GET /client/roster, filterable by client/location/title. */
export const getManagerPlanRosterFromDB = async (params: ManagerPlanRosterParams) => {
    const { client, location, searchTerm, ...rosterParams } = params;
    const planFilter: Record<string, unknown> = { is_active: true };

    if (client !== undefined) {
        if (!mongoose.isValidObjectId(client)) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Invalid client ID');
        }
        planFilter.client = new Types.ObjectId(client);
    }
    if (location !== undefined) {
        if (!mongoose.isValidObjectId(location)) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Invalid location ID');
        }
        planFilter.location = new Types.ObjectId(location);
    }
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        planFilter.title = { $regex: escaped, $options: 'i' };
    }

    return getPlanGroupedRosterFromDB(planFilter, rosterParams);
};

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

    // Resolve the display-name snapshot server-side; existing entries keep theirs.
    const workerDocs = newlyAddedWorkers.length
        ? await Worker.find({
              _id: { $in: newlyAddedWorkers.map((aw) => aw.worker) },
          })
              .select('name')
              .lean()
        : [];
    const nameById = new Map(workerDocs.map((w) => [w._id.toString(), w.name]));

    const previousWorkerIds = [...existingByWorkerId.keys()];

    const nextAssignedWorkers = assignedWorkers.map((aw) => {
        const workerIdStr = aw.worker.toString();
        const existing = existingByWorkerId.get(workerIdStr);

        if (existing) {
            // Attendance state is never rewritten by a roster edit — only role is editable.
            return {
                worker: existing.worker,
                name: existing.name,
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
            name: nameById.get(workerIdStr) ?? '',
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

    return result;
};

const FULL_WEEKDAY_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];

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

/** Auto-advances status to 'completed' once every task is done — never re-triggers or revives a cancelled shift. */
const maybeAutoCompleteShift = async (shiftId: Types.ObjectId) => {
    const shift = await Shift.findById(shiftId)
        .select('tasks status cleaning_plan')
        .lean();
    if (!shift || !shift.tasks.length) return;
    const allTasksCompleted = shift.tasks.every((t) => t.is_completed);
    if (!allTasksCompleted) return;

    const updateResult = await Shift.updateOne(
        { _id: shiftId, status: { $in: ['upcoming', 'in_progress'] } },
        { $set: { status: 'completed' } }
    );

    // Only the call that actually flips the status fires the event.
    if (updateResult.modifiedCount > 0) {
        const plan = await CleaningPlan.findById(shift.cleaning_plan)
            .select('client')
            .lean();
        if (plan) {
            emitAppEvent('shift.completed', {
                shiftId: shiftId.toString(),
                planId: shift.cleaning_plan.toString(),
                clientId: plan.client.toString(),
            });
        }
    }
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

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

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

/** Records a manager's decision on one photo — a quality record, doesn't reopen the task or touch is_completed. */
/** Makes an approved photo the reference for future shifts — writes to the source Task, not this shift's snapshot. */
const promoteApprovedPhotoToReference = async (
    taskId: string,
    title: string,
    photoUrl: string
) => {
    try {
        await Task.updateOne(
            { _id: new Types.ObjectId(taskId) },
            { $set: { 'photo_requirements.$[p].reference_image_url': photoUrl } },
            { arrayFilters: [{ 'p.title': title }] }
        );
    } catch {
        // A verdict must still be recorded if this fails.
    }
};

export const setPhotoVerdict = async (
    managerId: string,
    planId: string,
    date: Date,
    taskId: string,
    title: string,
    verdict: 'approved' | 'rejected',
    note?: string
) => {
    const shift = await getShiftOrThrow(planId, date);

    const task = shift.tasks.find((t) => t.task.toString() === taskId);
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found on this shift');
    }
    const requirement = task.photo_requirements.find((p) => p.title === title);
    if (!requirement) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Unknown photo requirement "${title}" for this task`
        );
    }
    if (!requirement.is_uploaded) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'No photo has been uploaded for this requirement yet'
        );
    }

    await Shift.updateOne(
        { _id: shift._id },
        {
            $set: {
                'tasks.$[t].photo_requirements.$[p].manager_verdict': verdict,
                'tasks.$[t].photo_requirements.$[p].manager_verdict_by':
                    new Types.ObjectId(managerId),
                'tasks.$[t].photo_requirements.$[p].manager_verdict_at': new Date(),
                'tasks.$[t].photo_requirements.$[p].manager_note': note ?? null,
                // Leaves the queue — must not be picked up by the auto-accept sweep later.
                'tasks.$[t].photo_requirements.$[p].auto_accepted': false,
            },
        },
        {
            arrayFilters: [
                { 't.task': new Types.ObjectId(taskId) },
                { 'p.title': title },
            ],
        }
    );

    if (verdict === 'approved' && requirement.photo_url) {
        await promoteApprovedPhotoToReference(
            taskId,
            title,
            requirement.photo_url
        );
    }

    return Shift.findById(shift._id);
};

export interface PhotoReviewQueryParams {
    from?: Date;
    to?: Date;
    planId?: string;
    locationId?: string;
    /** 'pending' keeps only rows a manager has not decided on yet. */
    status?: 'pending' | 'decided' | 'all';
}

export interface PhotoReviewPhoto {
    title: string;
    photo_url: string;
    description: string | null;
    reference_image_url: string | null;

    ai_status: string | null;
    ai_score: number | null;
    ai_confidence: number | null;
    ai_reason: string | null;
    ai_checks: { item: string; passed: boolean | null; note?: string }[];
    ai_subject_matches: boolean | null;
    ai_requirement_met: boolean | null;
    ai_evaluated_at: Date | null;

    gate_status: string | null;
    gate_reason: string | null;
    attempt_count: number;
    forced_accept: boolean;
    audit_sampled: boolean;

    manager_verdict: 'approved' | 'rejected' | null;
    manager_verdict_at: Date | null;
    manager_note: string | null;
    auto_decided: boolean;
    auto_decision: 'approved' | 'rejected' | null;
    escalated_at: Date | null;
    auto_accepted: boolean;
}

export interface PhotoReviewRow {
    /** Identifiers the manager UI needs to submit a verdict. */
    shift_id: string;
    plan_id: string;
    task_id: string;
    shift_date: Date;

    cleaning_name: string;
    room_name: string;
    task_name: string;
    duration_minutes: number;
    location_name: string;
    address: string | null;

    /** Lower sorts first. Drives the default queue order. */
    review_priority: number;
    /** True while at least one photo still needs a manager decision. */
    needs_review: boolean;

    uploaded_photos: PhotoReviewPhoto[];
}

/** Queue position for one photo — forced-accepts and wrong-subject photos rank above borderline scores. */
const photoReviewPriority = (photo: PhotoReviewPhoto): number => {
    if (photo.manager_verdict) return 90;
    if (photo.auto_decided) return 85;
    // A clean AI pass settles it regardless of how many retries it took.
    if (photo.ai_status === 'passed') return 80;
    if (photo.forced_accept) return 1;
    if (photo.ai_subject_matches === false) return 2;
    if (photo.ai_status === 'failed') return 3;
    if (photo.ai_status === 'review') return 4;
    if (photo.audit_sampled) return 5;
    if (photo.ai_status === 'error' || photo.ai_status === 'pending') return 6;
    if (!photo.ai_status) return 7;
    return 8;
};

/** Whether a photo still needs a human eye — a clean AI verdict settles it unless the audit sampler pulled it. */
const photoNeedsReview = (photo: PhotoReviewPhoto): boolean => {
    if (photo.manager_verdict) return false;
    if (photo.auto_decided) return photo.audit_sampled;
    if (photo.auto_accepted) return false;
    if (photo.ai_status === 'passed') return photo.audit_sampled;
    return true;
};

/**
 * Manager-facing photo review list: one row per shift task instance that has
 * at least one uploaded photo, across shifts in the given date range
 * (default: the last 30 days through today), optionally narrowed to one
 * cleaning plan or location.
 */
export const getPhotoReviewListFromDB = async (
    params: PhotoReviewQueryParams
): Promise<PhotoReviewRow[]> => {
    const to = params.to ?? new Date();
    const from =
        params.from ??
        (() => {
            const d = new Date(to);
            d.setUTCDate(d.getUTCDate() - 30);
            return d;
        })();

    const filter: Record<string, unknown> = { date: { $gte: from, $lte: to } };
    if (params.planId) filter.cleaning_plan = new Types.ObjectId(params.planId);
    if (params.locationId)
        filter['location.location'] = new Types.ObjectId(params.locationId);

    const shifts = await Shift.find(filter)
        .select('cleaning_plan date location rooms tasks')
        .sort({ date: -1 })
        .lean();

    if (!shifts.length) return [];

    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const locationIds = [
        ...new Set(shifts.map((s) => s.location.location.toString())),
    ];

    const [plans, locations] = await Promise.all([
        CleaningPlan.find({ _id: { $in: planIds } }).select('title').lean(),
        Location.find({ _id: { $in: locationIds } }).select('address').lean(),
    ]);

    const planTitleById = new Map(plans.map((p) => [p._id.toString(), p.title]));
    const addressById = new Map(
        locations.map((l) => [l._id.toString(), l.address])
    );

    const rows: PhotoReviewRow[] = [];

    for (const shift of shifts) {
        const roomNameByRoomId = new Map(
            shift.rooms.map((r) => [r.room.toString(), r.name])
        );
        const cleaningName =
            planTitleById.get(shift.cleaning_plan.toString()) ?? '';
        const address = addressById.get(shift.location.location.toString()) ?? null;

        for (const task of shift.tasks) {
            if (!task.is_photo_required) continue;
            const uploadedPhotos: PhotoReviewPhoto[] = task.photo_requirements
                .filter((p) => p.is_uploaded)
                .map((p) => ({
                    title: p.title,
                    photo_url: p.photo_url as string,
                    description: p.description ?? null,
                    reference_image_url: p.reference_image_url ?? null,

                    ai_status: p.ai_status ?? null,
                    ai_score: p.ai_score ?? null,
                    ai_confidence: p.ai_confidence ?? null,
                    ai_reason: p.ai_reason ?? null,
                    ai_checks: p.ai_checks ?? [],
                    ai_subject_matches: p.ai_subject_matches ?? null,
                    ai_requirement_met: p.ai_requirement_met ?? null,
                    ai_evaluated_at: p.ai_evaluated_at ?? null,

                    gate_status: p.gate_status ?? null,
                    gate_reason: p.gate_reason ?? null,
                    attempt_count: p.attempt_count ?? 0,
                    forced_accept: p.forced_accept ?? false,
                    audit_sampled: p.audit_sampled ?? false,

                    manager_verdict: p.manager_verdict ?? null,
                    manager_verdict_at: p.manager_verdict_at ?? null,
                    manager_note: p.manager_note ?? null,
                    auto_decided: p.auto_decided ?? false,
                    auto_decision: p.auto_decision ?? null,
                    escalated_at: p.escalated_at ?? null,
                    auto_accepted: p.auto_accepted ?? false,
                }));
            if (!uploadedPhotos.length) continue;

            const priority = Math.min(
                ...uploadedPhotos.map((p) => photoReviewPriority(p))
            );
            const needsReview = uploadedPhotos.some(photoNeedsReview);

            if (params.status === 'pending' && !needsReview) continue;
            if (params.status === 'decided' && needsReview) continue;

            rows.push({
                shift_id: shift._id.toString(),
                plan_id: shift.cleaning_plan.toString(),
                task_id: task.task.toString(),
                shift_date: shift.date,

                cleaning_name: cleaningName,
                room_name: task.room ? roomNameByRoomId.get(task.room.toString()) ?? '' : '',
                task_name: task.name,
                duration_minutes: task.duration_minutes,
                location_name: shift.location.name,
                address,

                review_priority: priority,
                needs_review: needsReview,
                uploaded_photos: uploadedPhotos,
            });
        }
    }

    // Most urgent first, then newest.
    rows.sort(
        (a, b) =>
            a.review_priority - b.review_priority ||
            b.shift_date.getTime() - a.shift_date.getTime()
    );

    return rows;
};

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
