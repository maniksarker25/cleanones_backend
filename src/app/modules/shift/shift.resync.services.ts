import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import {
    anyPatternOccursOnDate,
    normalizeToUTCDateOnly,
    occursOnDate,
    RecurrencePattern,
    taskToPattern,
} from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Location } from '../location/location.model';
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import { TTaskFrequency } from '../task/task.interface';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';
import {
    pickRandom,
    roomsWithDueTasks,
    toShiftTaskFromAdditionalTask,
} from './shift.snapshot.util';
import { maybeAutoCompleteShift } from './shift.shared.util';

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
