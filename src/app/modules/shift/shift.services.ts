import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import {
    anyPatternOccursOnDate,
    combineDateWithTimeOfDay,
    normalizeToUTCDateOnly,
} from '../cleaning_plan/availability.util';
import { IAssignedWorker } from '../cleaning_plan/cleaning_plan.interface';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { assertWorkersEligible } from '../worker/worker.eligibility.util';
import { Worker } from '../worker/worker.model';
import { findWorkerConflictOnDate } from './shift.availability.services';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';
import { buildShiftSnapshot, recomputeTaskCompletion } from './shift.snapshot.util';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: number }).code === MONGO_DUPLICATE_KEY_ERROR;

const ensureActivePlan = async (planId: string | Types.ObjectId) => {
    const plan = await CleaningPlan.findById(planId);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

/** Builds an unsaved (`is_virtual: true`) shift shape from the plan's current live state. */
const buildVirtualShift = async (
    plan: {
        _id: Types.ObjectId;
        rooms: Types.ObjectId[];
        assigned_workers: IAssignedWorker[];
        date_time: Date;
        end_date?: Date | null;
    },
    day: Date
) => {
    const snapshot = await buildShiftSnapshot(plan);
    if (!anyPatternOccursOnDate(snapshot.patterns, day)) return null;

    return {
        cleaning_plan: plan._id,
        date: day,
        date_time: combineDateWithTimeOfDay(day, plan.date_time),
        rooms: snapshot.rooms,
        tasks: snapshot.tasks,
        duration_minutes: snapshot.durationMinutes,
        assigned_workers: snapshot.assignedWorkers,
        is_worker_overridden: false,
        status: 'upcoming' as const,
        is_virtual: true,
    };
};

/**
 * The single write path for materializing a Shift. Called from both the
 * manual worker-reassignment/photo-upload flows and the daily cron job, so
 * exactly one code path ever creates a Shift document — behavior can't drift
 * between them.
 *
 * Idempotent under concurrency via the { cleaning_plan, date } unique index:
 * if two callers race to create the same occurrence, the loser's insert
 * fails with a duplicate-key error, which it recovers from by re-fetching
 * the winner's document instead of erroring out.
 */
export const getOrCreateShift = async (
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
            'Cannot create a shift for an inactive cleaning plan'
        );
    }

    const snapshot = await buildShiftSnapshot(plan);
    if (!anyPatternOccursOnDate(snapshot.patterns, day)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This cleaning plan has no occurrence on the given date'
        );
    }

    try {
        return await Shift.create({
            cleaning_plan: plan._id,
            date: day,
            date_time: combineDateWithTimeOfDay(day, plan.date_time),
            rooms: snapshot.rooms,
            tasks: snapshot.tasks,
            duration_minutes: snapshot.durationMinutes,
            assigned_workers: snapshot.assignedWorkers,
            is_worker_overridden: false,
            status: 'upcoming',
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            // Lost the race to a concurrent creator (another request or the
            // cron job) — their document is authoritative, use it.
            const winner = await Shift.findOne({ cleaning_plan: planId, date: day });
            if (winner) return winner;
        }
        throw error;
    }
};

/**
 * Read-only preview for a single date: returns the materialized Shift if one
 * exists, otherwise builds an equivalent, unsaved shape from the plan's
 * current live state (`is_virtual: true`) — no DB write happens here.
 */
export const getShiftForDate = async (planId: string, date: Date) => {
    const day = normalizeToUTCDateOnly(date);
    const existing = await Shift.findOne({ cleaning_plan: planId, date: day }).lean();
    if (existing) return { ...existing, is_virtual: false };

    const plan = await ensureActivePlan(planId);
    return buildVirtualShift(plan, day);
};

/**
 * Lists every occurrence of the plan between [from, to], each either the
 * materialized Shift or a virtual preview — dates the plan doesn't occur on
 * are omitted entirely rather than returned as empty placeholders.
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
            results.push({ ...existing, is_virtual: false });
            continue;
        }
        if (!anyPatternOccursOnDate(snapshot.patterns, day)) continue;
        results.push({
            cleaning_plan: plan._id,
            date: day,
            date_time: combineDateWithTimeOfDay(day, plan.date_time),
            rooms: snapshot.rooms,
            tasks: snapshot.tasks,
            duration_minutes: snapshot.durationMinutes,
            assigned_workers: snapshot.assignedWorkers,
            is_worker_overridden: false,
            status: 'upcoming',
            is_virtual: true,
        });
    }
    return results;
};

/** Saved assignments always override plan defaults, including worker removals. */
export const listWorkerShiftsForDate = async (workerId: string, date: Date) => {
    const day = normalizeToUTCDateOnly(date);
    const plans = await CleaningPlan.find({
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms date_time end_date assigned_workers')
        .lean();

    // Include saved occurrences of candidate plans even if this worker was
    // removed from them. Their existence must suppress a virtual fallback.
    const saved = await Shift.find({
        date: day,
        $or: [
            { 'assigned_workers.worker': workerId },
            { cleaning_plan: { $in: plans.map((plan) => plan._id) } },
        ],
    }).lean();
    const savedPlanIds = new Set(saved.map((shift) => shift.cleaning_plan.toString()));
    const results = saved
        .filter((shift) =>
            shift.assigned_workers.some((entry) => entry.worker.toString() === workerId)
        )
        .map((shift) => ({ ...shift, is_virtual: false }));

    const virtual = [];
    for (const plan of plans) {
        if (savedPlanIds.has(plan._id.toString())) continue;
        const virtualShift = await buildVirtualShift(plan, day);
        if (virtualShift) virtual.push(virtualShift);
    }
    return [...results, ...virtual].sort(
        (a, b) =>
            a.date_time.getTime() - b.date_time.getTime() ||
            a.cleaning_plan.toString().localeCompare(b.cleaning_plan.toString())
    );
};

/**
 * Reassigns workers for one specific occurrence only, materializing the
 * shift first if it doesn't exist yet. Mirrors the plan-level assignment
 * rules: ineligible workers are always rejected; scheduling conflicts are
 * rejected unless `force`, in which case the conflicted entries are flagged
 * for audit purposes.
 */
export const assignWorkersToShift = async (
    managerId: string,
    planId: string,
    date: Date,
    assignedWorkers: IAssignedWorker[],
    force: boolean
) => {
    const shift = await getOrCreateShift(planId, date);

    await assertWorkersEligible(assignedWorkers.map((aw) => aw.worker));

    const conflictEntries = new Map<
        string,
        { conflicting_plan_id: Types.ObjectId; reason: string }
    >();
    for (const aw of assignedWorkers) {
        const conflict = await findWorkerConflictOnDate(
            aw.worker,
            shift.date,
            shift.date_time,
            shift.duration_minutes,
            { shiftId: shift._id, planId: shift.cleaning_plan }
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

    // The client only sends { worker, role } — resolve the display-name
    // snapshot server-side rather than trusting a client-supplied name.
    const workerDocs = await Worker.find({
        _id: { $in: assignedWorkers.map((aw) => aw.worker) },
    })
        .select('name')
        .lean();
    const nameById = new Map(workerDocs.map((w) => [w._id.toString(), w.name]));

    const result = await Shift.findByIdAndUpdate(
        shift._id,
        {
            assigned_workers: assignedWorkers.map((aw) => ({
                worker: aw.worker,
                name: nameById.get(aw.worker.toString()) ?? '',
                role: aw.role,
                assigned_with_conflict: conflictEntries.has(aw.worker.toString()),
            })),
            is_worker_overridden: true,
            last_updated_by: managerId,
        },
        { new: true, runValidators: true }
    );
    return result;
};

export const updateShiftStatus = async (
    managerId: string,
    planId: string,
    date: Date,
    status: IShift['status']
) => {
    const shift = await getOrCreateShift(planId, date);
    const result = await Shift.findByIdAndUpdate(
        shift._id,
        { status, last_updated_by: managerId },
        { new: true, runValidators: true }
    );
    return result;
};

/**
 * Records a worker's photo submission for one task instance within one
 * shift, materializing the shift first if needed. `is_completed` on that
 * task entry is recomputed automatically — there is no manual
 * complete/approve step (see docs/SHIFT_MANAGEMENT_DESIGN.md).
 */
export const uploadShiftTaskPhoto = async (
    workerId: string,
    planId: string,
    date: Date,
    taskId: string,
    title: string,
    photoUrl: string
) => {
    const shift = await getOrCreateShift(planId, date);

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

    // Atomic, targeted write for the actual photo field — safe under
    // concurrent uploads to different requirements/tasks on the same shift.
    await Shift.updateOne(
        { _id: shift._id },
        {
            $set: {
                'tasks.$[t].photo_requirements.$[p].photo_url': photoUrl,
                'tasks.$[t].photo_requirements.$[p].is_uploaded': true,
            },
        },
        {
            arrayFilters: [
                { 't.task': new Types.ObjectId(taskId) },
                { 'p.title': title },
            ],
        }
    );

    // is_completed depends on the FULL set of that task's requirements, so
    // it's recomputed from a fresh read rather than assumed from this write.
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

    return Shift.findById(shift._id);
};

const shiftServices = {
    listWorkerShiftsForDate,
    getOrCreateShift,
    getShiftForDate,
    listShiftsInRange,
    assignWorkersToShift,
    updateShiftStatus,
    uploadShiftTaskPhoto,
};

export default shiftServices;
