import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import {
    anyPatternOccursOnDate,
    combineDateWithTimeOfDay,
    normalizeToUTCDateOnly,
    taskToPattern,
} from '../cleaning_plan/availability.util';
import { IAssignedWorker } from '../cleaning_plan/cleaning_plan.interface';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Client } from '../client/client.model';
import { Location } from '../location/location.model';
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import { assertWorkersEligible } from '../worker/worker.eligibility.util';
import { WorkerType } from '../worker/worker.constant';
import { Worker } from '../worker/worker.model';
import { IssueReport } from '../issue_report/issue_report.model';
import { haversineDistanceMeters } from './geo.util';
import { findWorkerConflictOnDate } from './shift.availability.services';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';
import { buildShiftSnapshot, pickRandom, recomputeTaskCompletion } from './shift.snapshot.util';

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
        location: Types.ObjectId;
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
        location: snapshot.location,
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
            location: snapshot.location,
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
 * If today's shift is already materialized, keeps its assigned_workers in
 * sync with the plan's current roster. getOrCreateShift alone can't do this:
 * it only ever creates a shift on first materialization and is a no-op
 * afterward, so a plan-level assignment change made after today's shift
 * already exists would otherwise leave that shift permanently pointing at
 * whoever was assigned at materialization time — invisible to the worker's
 * own shift list/check-in, since both key off the shift's own snapshot, not
 * the live plan.
 *
 * Skipped when a manager has manually overridden this specific day via
 * PATCH /shift/:planId/:date/assign-workers (`is_worker_overridden`) — that
 * per-day override is deliberately more specific than the plan's default
 * roster and must not be clobbered by a plan-level edit.
 *
 * Preserves each remaining worker's check-in/check-out timestamps so this
 * can never erase in-progress attendance — it only adds/removes roster
 * entries and refreshes name/role snapshots.
 */
export const resyncTodayShiftWorkersIfDue = async (
    planId: Types.ObjectId | string,
    assignedWorkers: IAssignedWorker[]
) => {
    const today = normalizeToUTCDateOnly(new Date());
    const shift = await Shift.findOne({ cleaning_plan: planId, date: today });
    if (!shift || shift.is_worker_overridden) return null;

    const previousByWorker = new Map(
        shift.assigned_workers.map((aw) => [aw.worker.toString(), aw])
    );

    const workerDocs = await Worker.find({
        _id: { $in: assignedWorkers.map((aw) => aw.worker) },
    })
        .select('name')
        .lean();
    const nameById = new Map(workerDocs.map((w) => [w._id.toString(), w.name]));

    const nextAssignedWorkers = assignedWorkers.map((aw) => {
        const previous = previousByWorker.get(aw.worker.toString());
        return {
            worker: aw.worker,
            name: nameById.get(aw.worker.toString()) ?? '',
            role: aw.role,
            assigned_with_conflict: aw.assigned_with_conflict ?? false,
            check_in_at: previous?.check_in_at ?? null,
            check_in_coordinates: previous?.check_in_coordinates ?? null,
            check_out_at: previous?.check_out_at ?? null,
            check_out_coordinates: previous?.check_out_coordinates ?? null,
        };
    });

    return Shift.findByIdAndUpdate(
        shift._id,
        { assigned_workers: nextAssignedWorkers },
        { new: true, runValidators: true }
    );
};

/**
 * Recomputes a shift's `tasks[]` from the current active Tasks under
 * `roomIds` — additions, removals, AND edits (name/duration_minutes/
 * is_photo_required/photo_requirements) to a task that still exists.
 * Shared by both resync entry points below (one triggered by a Task edit,
 * the other by a plan's room-list edit), so the merge rules can't drift
 * between them.
 *
 * For a task that still exists, `photo_requirements` (the randomly-selected
 * subset actually attached to this shift) is reconciled against the
 * template's current pool/`required_photo_count` rather than blindly
 * re-copied: a previously-selected title still present in the pool keeps its
 * `photo_url`/`is_uploaded` (edits never erase upload progress); if the
 * selected count now falls short of `required_photo_count` (pool grew, count
 * increased, or a selected title was removed from the pool), more titles are
 * randomly drawn from the remaining pool to top back up to the target count;
 * if the selected count now exceeds the target (count decreased), the excess
 * is trimmed, preferring to drop not-yet-uploaded titles first. `is_completed`
 * is then recomputed the normal way for a photo-required task (true once
 * every selected requirement is uploaded); for a no-photo task it's left
 * exactly as-is, since that one is only ever changed by the worker's explicit
 * mark-complete action, never by a plan edit.
 */
const computeSyncedShiftTasks = async (
    shift: Pick<IShift, 'tasks'>,
    roomIds: (Types.ObjectId | string)[]
) => {
    const activeTasks = await Task.find({
        room: { $in: roomIds },
        is_active: true,
    })
        .select(
            'room name duration_minutes is_photo_required photo_requirements required_photo_count'
        )
        .lean();

    const existingByTaskId = new Map(
        shift.tasks.map((t) => [t.task.toString(), t])
    );

    let changed = activeTasks.length !== shift.tasks.length;

    const nextTasks = activeTasks.map((t) => {
        const existing = existingByTaskId.get(t._id.toString());

        const pool = t.photo_requirements ?? [];
        const targetCount = t.is_photo_required
            ? Math.min(t.required_photo_count ?? 0, pool.length)
            : 0;

        let photoRequirements: {
            title: string;
            photo_url: string | null;
            is_uploaded: boolean;
        }[];

        if (!t.is_photo_required) {
            photoRequirements = [];
        } else if (!existing || !existing.is_photo_required) {
            // Brand-new task, or a task just switched to photo-required: fresh random pick.
            photoRequirements = pickRandom(pool, targetCount).map((pr) => ({
                title: pr.title,
                photo_url: null,
                is_uploaded: false,
            }));
        } else {
            const poolTitles = new Set(pool.map((pr) => pr.title));
            let kept = existing.photo_requirements.filter((p) =>
                poolTitles.has(p.title)
            );

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

    const durationMinutes = nextTasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0),
        0
    );

    return { tasks: nextTasks, durationMinutes, changed };
};

/**
 * If today's shift for a plan touching these rooms is already materialized
 * AND still 'upcoming', syncs its `tasks[]` to match the rooms' current
 * active Tasks. Called after a Task is created, updated, or (soft-)deleted,
 * so any edit on a room is reflected in today's shift the same way it
 * already is for future/virtual occurrences (those are built live from the
 * plan's current state every time, so they need no fixup at all).
 *
 * Deliberately skipped for 'in_progress'/'completed'/'cancelled' shifts —
 * work already underway or finished must never be retroactively altered by
 * a plan/task edit made afterward.
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
        .select('rooms')
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
            plan.rooms
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
 * If today's shift for this plan is already materialized AND still
 * 'upcoming', syncs its `rooms[]` AND `tasks[]` to match the plan's current
 * room list. Covers the gap resyncTodayShiftTasksForRoomsIfDue can't: that
 * one only fires for a room already in the plan's rooms array, so assigning
 * a brand-new room (with its own tasks) onto the plan via a plan update
 * never touched an already-materialized today's shift — it would keep
 * showing whatever rooms/tasks existed at materialization time until the
 * next midnight cron. Called from cleaning_plan.services.ts whenever a
 * plan's `rooms` array changes.
 *
 * Deliberately skipped for 'in_progress'/'completed'/'cancelled' shifts,
 * same reasoning as resyncTodayShiftTasksForRoomsIfDue.
 */
export const resyncTodayShiftRoomsIfDue = async (
    planId: Types.ObjectId | string,
    roomIds: (Types.ObjectId | string)[]
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
    const nextRooms = rooms.map((r) => ({
        room: r._id,
        name: r.name,
        room_type: r.room_type,
    }));

    const { tasks, durationMinutes } = await computeSyncedShiftTasks(shift, roomIds);

    await Shift.updateOne(
        { _id: shift._id, status: 'upcoming' },
        { $set: { rooms: nextRooms, tasks, duration_minutes: durationMinutes } }
    );

    await maybeAutoCompleteShift(shift._id);

    return null;
};

/**
 * Read-only preview for a single date: returns the materialized Shift if one
 * exists, otherwise builds an equivalent, unsaved shape from the plan's
 * current live state (`is_virtual: true`) — no DB write happens here.
 *
 * `requestingWorkerId` is an ownership gate: when provided (the caller is a
 * worker, not a manager), the shift/preview is only returned if that worker
 * is actually in `assigned_workers` — otherwise 403, regardless of whether
 * the shift is real or virtual. Omitted entirely for manager calls, which
 * can view any shift.
 */
export const getShiftForDate = async (
    planId: string,
    date: Date,
    requestingWorkerId?: string
) => {
    const day = normalizeToUTCDateOnly(date);
    const existing = await Shift.findOne({ cleaning_plan: planId, date: day }).lean();
    const result = existing
        ? { ...existing, is_virtual: false }
        : await buildVirtualShift(await ensureActivePlan(planId), day);

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
            location: snapshot.location,
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
        .select('location rooms date_time end_date assigned_workers')
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
 * Per-room progress = completed tasks in that room / total tasks in that
 * room. Overall shift progress = average of the rooms' progress (not a raw
 * task count across the whole shift), so one large room doesn't drown out a
 * small one. completed_room counts rooms at 100% — useful for an "X/Y rooms"
 * style summary. Keeps `tasks` in the result; callers that don't want the
 * full per-task detail (e.g. the client live-status list) strip it themselves.
 */
const attachProgress = (shift: IShift & { _id: Types.ObjectId }) => {
    const rooms = shift.rooms.map((room) => {
        const roomTasks = shift.tasks.filter(
            (t) => t.room.toString() === room.room.toString()
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
        rooms,
        total_room: shift.rooms.length,
        completed_room: rooms.filter((r) => r.progress_percent === 100).length,
        total_task: shift.tasks.length,
        overall_progress_percent: overallProgressPercent,
    };
};

/**
 * Client-facing "what's happening right now": every in_progress shift across
 * all of this client's active cleaning plans, each with room-level and
 * overall completion progress computed live (never cached/stored). Full
 * per-task detail is intentionally omitted — this is a summary view.
 */
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

/**
 * Worker's own current shift: status in_progress AND this specific worker is
 * still personally checked in (their own check_in_at set, check_out_at
 * null) — not just "assigned to some in-progress shift", since other
 * workers on the same shift may still be working after this one left.
 * Returns {} when there isn't one, per the dashboard's "no active shift" state.
 */
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
    return rest;
};

/**
 * Today's shift counters for the worker's dashboard: total (saved + virtual
 * occurrences, same as /shift/my-shifts), completed, and pending (today's
 * total minus completed — includes upcoming/in_progress/cancelled alike).
 */
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

// A materialized Shift only ever exists for TODAY at the earliest (the
// nightly cron materializes one day at a time; nothing pre-materializes
// further out). So "next shift" can't rely on Shift documents alone — a
// worker's next occurrence days out is real, it just hasn't been written to
// the DB yet. This projects forward through the recurrence patterns of the
// worker's active plans to find it, same as the cron/virtual-preview paths
// already do for a single day.
const NEXT_SHIFT_PROJECTION_HORIZON_DAYS = 90;

/**
 * The worker's next upcoming shift, strictly after now — whichever is
 * sooner of: the nearest already-materialized Shift assigned to this worker,
 * or the nearest not-yet-materialized occurrence projected from the
 * recurrence patterns of the plans this worker is currently assigned to.
 * Returns {} when there is genuinely nothing within the projection horizon.
 */
export const getNextShiftForWorker = async (workerId: string) => {
    const now = new Date();

    const materialized = await Shift.findOne({
        'assigned_workers.worker': workerId,
        status: 'upcoming',
        date_time: { $gt: now },
    })
        .sort({ date_time: 1 })
        .lean();

    const plans = await CleaningPlan.find({
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    }).lean();

    let bestVirtual: {
        plan: (typeof plans)[number];
        day: Date;
        occurrenceDateTime: Date;
        snapshot: Awaited<ReturnType<typeof buildShiftSnapshot>>;
    } | null = null;

    for (const plan of plans) {
        const snapshot = await buildShiftSnapshot(plan);
        const today = normalizeToUTCDateOnly(now);
        for (let i = 0; i <= NEXT_SHIFT_PROJECTION_HORIZON_DAYS; i++) {
            const day = new Date(today);
            day.setUTCDate(day.getUTCDate() + i);
            if (!anyPatternOccursOnDate(snapshot.patterns, day)) continue;

            const occurrenceDateTime = combineDateWithTimeOfDay(day, plan.date_time);
            if (occurrenceDateTime <= now) continue; // today's slot already passed

            if (!bestVirtual || occurrenceDateTime < bestVirtual.occurrenceDateTime) {
                bestVirtual = { plan, day, occurrenceDateTime, snapshot };
            }
            break; // nearest occurrence for THIS plan found — stop scanning further days
        }
    }

    const materializedAt = materialized?.date_time ?? null;
    const virtualAt = bestVirtual?.occurrenceDateTime ?? null;

    if (materializedAt && (!virtualAt || materializedAt <= virtualAt)) {
        const { tasks, rooms, assigned_workers, ...rest } = materialized!;
        return { ...rest, is_virtual: false };
    }

    if (bestVirtual) {
        const { plan, day, snapshot, occurrenceDateTime } = bestVirtual;
        return {
            cleaning_plan: plan._id,
            date: day,
            date_time: occurrenceDateTime,
            location: snapshot.location,
            duration_minutes: snapshot.durationMinutes,
            is_worker_overridden: false,
            status: 'upcoming' as const,
            is_virtual: true,
        };
    }

    return {};
};

/**
 * System-wide "today's shifts at a glance" for the manager dashboard — every
 * manager sees the same numbers, not scoped to who's calling. Only counts
 * already-materialized Shift documents for today — the nightly cron (plus
 * this system's same-day auto-materialization on plan create/update/assign)
 * means today's occurrences are expected to already exist by the time
 * anyone looks at this.
 *
 * today_total_pending_shift maps to status 'upcoming' (not yet checked
 * into); a cancelled shift still counts toward today_total_shift but isn't
 * reflected in today_total_completed_shift/today_total_in_progress_shift/
 * today_total_pending_shift.
 *
 * today_total_worker_late counts DISTINCT workers (not shift-assignment
 * rows) whose shift's scheduled date_time has already passed but who still
 * haven't checked in (check_in_at is null), excluding cancelled shifts — no
 * grace period beyond the exact scheduled start time.
 *
 * total_issue_report is NOT date-scoped like the others — it's the current,
 * system-wide count of issue reports still open (status PENDING or
 * IN_PROGRESS), i.e. everything not yet RESOLVED, regardless of when it was
 * filed.
 */
export const getTodayLiveShiftMetaFromDB = async () => {
    const today = normalizeToUTCDateOnly(new Date());
    const now = new Date();

    const [shifts, totalIssueReport] = await Promise.all([
        Shift.find({ date: today })
            .select('status date_time assigned_workers')
            .lean(),
        IssueReport.countDocuments({ status: { $ne: 'RESOLVED' } }),
    ]);

    const lateWorkerIds = new Set<string>();
    shifts.forEach((shift) => {
        if (shift.status === 'cancelled' || shift.date_time > now) return;
        shift.assigned_workers.forEach((aw) => {
            if (!aw.check_in_at) lateWorkerIds.add(aw.worker.toString());
        });
    });

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
        today_total_worker_late: lateWorkerIds.size,
        total_issue_report: totalIssueReport,
    };
};

// ─── Manager report (week/month/quarter/year) ───────────────────────────────

export const REPORT_PERIODS = ['week', 'month', 'quarter', 'year'] as const;
export type TReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * "This week/month/quarter/year" as an inclusive [from, to] range of
 * UTC-normalized calendar days — same UTC-day convention the rest of the
 * shift system uses (see normalizeToUTCDateOnly), so a shift's `date` field
 * compares directly against these without extra conversion. Week starts
 * Monday (ISO week), matching the Mon..Sun labels on the dashboard.
 */
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

/**
 * Bucket granularity per period — deliberately gets finer as the range gets
 * shorter and coarser as it gets longer, so every period renders a readable
 * number of bars: week -> 1 bar/day (7 total), month -> 1 bar/day (28-31),
 * quarter -> 1 bar/week (~13), year -> 1 bar/month (12).
 */
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

/**
 * Manager dashboard report: total shifts + total issue reports for the
 * selected period, a shift-count trend chart bucketed per
 * buildShiftTrendBuckets, and an issue-report status breakdown (PENDING /
 * IN_PROGRESS / RESOLVED) — all scoped to the same [from, to] range, unlike
 * getTodayLiveShiftMetaFromDB's today_total_worker_late/total_issue_report
 * which are point-in-time, not period-scoped.
 */
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

/**
 * Batch-resolves { cleaning_plan: {_id, title}, client: {_id, name} } for a
 * set of shifts in at most two queries total (not one per shift), keyed by
 * shift cleaning_plan id. Short-circuits on an empty input to avoid two
 * pointless round trips on an empty page/result.
 */
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

// Allowlisted so a caller can't force a sort on an arbitrary/unindexed path
// (e.g. a large nested array field) and degrade this into a full in-memory
// sort under load.
const TODAY_LIVE_SHIFTS_SORTABLE_FIELDS = new Set([
    'date_time',
    'status',
    'createdAt',
    'updatedAt',
]);

const SHIFT_STATUSES = new Set<IShift['status']>([
    'upcoming',
    'in_progress',
    'completed',
    'cancelled',
]);

/**
 * Manager-facing list of today's shifts, system-wide (not scoped to the
 * calling manager, same as today-live-shift-meta), filterable by location
 * and client. A lean list view: room-level detail lives on the
 * single-live-shift endpoint instead — this only carries the summary totals.
 */
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

    const match: Record<string, unknown> = { date: today };

    const locationId = parseObjectIdQueryParam(query.location, 'location');
    if (locationId) {
        match['location.location'] = locationId;
    }

    const clientId = parseObjectIdQueryParam(query.client, 'client');
    if (clientId) {
        const planIds = await CleaningPlan.find({ client: clientId }).distinct('_id');
        // An empty $in never matches — correctly yields zero results instead
        // of accidentally falling through to "no client filter at all".
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
            // _id as a tiebreaker guarantees deterministic ordering across
            // pages even when many shifts share the same sortField value —
            // without it, concurrent writes can shift rows between pages or
            // repeat/skip a row under pagination.
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

/**
 * One shift's full detail: tasks[], rooms[] (with per-room progress),
 * assigned_workers[], plus cleaning_plan/client context — the counterpart to
 * getTodayLiveShiftsFromDB's lean list view. Not date/today-restricted; any
 * materialized shift can be fetched by its own _id.
 */
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
 * Manager-facing worker performance for one calendar month (UTC), combining
 * already-materialized Shift documents (the only source of truth for
 * completed/in_progress/late/absent/worked-hours — those require real
 * check-in/check-out data) with not-yet-materialized future occurrences of
 * the worker's currently active plans (so total_shift/total_upcoming for a
 * mostly-future month aren't artificially low just because the cron hasn't
 * caught up to those days yet).
 *
 * Definitions:
 * - late: this worker's own check_in_at is after the shift's scheduled date_time (no grace period).
 * - absent: the shift's calendar date is in the past, status isn't 'cancelled',
 *   and this worker never checked in. Only ever true for materialized shifts —
 *   if a plan's occurrence was never materialized at all (e.g. the cron
 *   didn't run that day), there is no record to judge absence from.
 * - total_work: sum of (check_out_at - check_in_at) across this worker's
 *   completed check-ins this month, in hours, rounded to 2 decimals.
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

    const materialized = await Shift.find({
        'assigned_workers.worker': workerId,
        date: { $gte: monthStart, $lte: monthEnd },
    }).lean();

    const materializedKeys = new Set(
        materialized.map((s) => `${s.cleaning_plan.toString()}|${s.date.toISOString()}`)
    );

    // Not-yet-materialized occurrences: only ever future (today-or-later, and
    // within this month), only from plans the worker is CURRENTLY assigned
    // to, skipping any (plan, day) pair that's already materialized.
    const plans = await CleaningPlan.find({
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    }).lean();

    const projectionStart = today > monthStart ? today : monthStart;
    let virtualCount = 0;
    if (projectionStart <= monthEnd) {
        for (const plan of plans) {
            const snapshot = await buildShiftSnapshot(plan);
            for (
                let day = new Date(projectionStart);
                day <= monthEnd;
                day.setUTCDate(day.getUTCDate() + 1)
            ) {
                const key = `${plan._id.toString()}|${day.toISOString()}`;
                if (materializedKeys.has(key)) continue;
                if (!anyPatternOccursOnDate(snapshot.patterns, day)) continue;
                virtualCount += 1;
            }
        }
    }

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

    return {
        month: targetMonth,
        year: targetYear,
        total_shift_on_this_month: materialized.length + virtualCount,
        total_completed_on_this_month: completed,
        total_in_progress: inProgress,
        total_upcoming_on_this_month: upcomingMaterialized + virtualCount,
        total_late_on_this_month: late,
        total_absent_on_this_month: absent,
        total_work_on_this_month: roundToTwoDecimals(workedMs / 3_600_000),
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
 * Manager-facing attendance summary metadata aggregated across ALL workers
 * for `period` ('today' | 'weekly' | 'monthly').
 *
 * Definitions (each assigned-worker entry across every shift in the period
 * counts separately — a shift with 3 assigned workers contributes up to 3
 * check-ins):
 * - completed_shifts: shifts with status 'completed' whose date falls in the period.
 * - total_hours: sum of (check_out_at - check_in_at) across every worker's
 *   completed check-ins in the period, in hours, rounded to 2 decimals.
 * - punctuality_percentage: of all worker check-ins that happened during the
 *   period, the share that were on-time (check_in_at <= shift's scheduled
 *   date_time, no grace period — same rule as getWorkerPerformanceFromDB's
 *   `late`). 0 when there were no check-ins in the period.
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
 * Manager-facing per-worker attendance rows for `period`, optionally
 * filtered by worker name (`searchTerm`) and/or `workerType`. One row per
 * active worker matching the filters, even those with zero shifts in the
 * period (hours_worked/total_shifts/late_days all 0).
 *
 * - total_shifts: count of shifts this worker was assigned to in the period.
 * - hours_worked: sum of (check_out_at - check_in_at) across this worker's
 *   completed check-ins in the period, in hours, rounded to 2 decimals.
 * - late_days: count of this worker's check-ins after the shift's scheduled
 *   date_time (no grace period — same rule used across this module).
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

/**
 * Single-worker attendance summary for `period` ('today' | 'weekly' | 'monthly'),
 * powering the worker profile's Attendance tab.
 *
 * Same definitions as getWorkersAttendanceSummaryFromDB, scoped to this
 * worker's own assigned-worker entry on each shift in the period:
 * - completed_shifts: this worker's shifts with status 'completed' in the period.
 * - total_hours: sum of (check_out_at - check_in_at) across this worker's
 *   completed check-ins in the period, in hours, rounded to 2 decimals.
 * - punctuality_percentage: of this worker's check-ins in the period, the
 *   share that were on-time (check_in_at <= shift's scheduled date_time, no
 *   grace period). 0 when there were no check-ins in the period.
 */
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
const getRosterDateRange = (
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
 * Manager-facing shift roster for the "Shift Roster" page: for `view`
 * ('day' | 'week' | 'month'), one PAGE of active workers (optionally
 * filtered by name/type, same filters as getWorkersAttendanceListFromDB)
 * with their shifts for each date in the range — merging already-
 * materialized Shift documents with not-yet-materialized virtual
 * occurrences of active plans, the same universe every other worker-facing
 * shift listing uses (e.g. listWorkerShiftsForDate). A materialized shift's
 * own assigned_workers/status is authoritative (it may have been reassigned
 * or progressed for that specific day); a virtual occurrence uses the
 * plan's current default roster and is always 'upcoming'.
 *
 * Pagination happens FIRST, on the Worker query itself (via a single
 * `$facet` aggregation that returns the page and the total count in one
 * round trip) — everything downstream (plans, tasks, locations,
 * materialized shifts) is then scoped to only this page's workers, not the
 * whole roster. This is what makes pagination actually cheap here: a
 * 500-worker company paginated at 20/page does five bulk queries sized for
 * 20 workers' plans, never for 500.
 *
 * Otherwise optimized the same way regardless of page size: one CleaningPlan
 * query, one bulk Task query across every candidate plan's rooms combined,
 * one bulk Location query, one bulk materialized-Shift query across the
 * whole date range — occurrence checking and duration for virtual days is
 * then pure in-memory work (no query inside the plan/day loop).
 */
export const getShiftRosterFromDB = async (params: RosterQueryParams) => {
    const { view, date, year, month, searchTerm, workerType } = params;
    const { start, end } = getRosterDateRange(view, date, year, month);

    const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 20) || 20));

    const workerFilter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (workerType) workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }

    // Single round trip for both the page and the total count, so pagination
    // metadata never costs a second query.
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

    const plans = await CleaningPlan.find({
        'assigned_workers.worker': { $in: workerIds },
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('location rooms date_time end_date assigned_workers')
        .lean();

    const allRoomIds = [
        ...new Set(plans.flatMap((p) => (p.rooms ?? []).map((r) => r.toString()))),
    ];
    const allLocationIds = [...new Set(plans.map((p) => p.location.toString()))];
    const planIds = plans.map((p) => p._id);

    const [tasks, locations, materializedShifts] = await Promise.all([
        Task.find({ room: { $in: allRoomIds }, is_active: true })
            .select('room frequency_type days_of_week days_of_month duration_minutes')
            .lean(),
        Location.find({ _id: { $in: allLocationIds } }).select('name').lean(),
        Shift.find({
            cleaning_plan: { $in: planIds },
            date: { $gte: start, $lt: end },
        }).lean(),
    ]);

    const tasksByRoom = new Map<string, typeof tasks>();
    for (const t of tasks) {
        const key = t.room.toString();
        const list = tasksByRoom.get(key);
        if (list) list.push(t);
        else tasksByRoom.set(key, [t]);
    }
    const locationNameById = new Map(locations.map((l) => [l._id.toString(), l.name]));
    const materializedByPlanDate = new Map(
        materializedShifts.map((s) => [
            `${s.cleaning_plan.toString()}|${s.date.toISOString()}`,
            s,
        ])
    );

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

    for (const plan of plans) {
        const planRoomIds = (plan.rooms ?? []).map((r) => r.toString());
        const planTasks = planRoomIds.flatMap((r) => tasksByRoom.get(r) ?? []);
        const patterns = planTasks.map((t) =>
            taskToPattern(t, plan.date_time, plan.end_date ?? null)
        );
        const virtualDurationMinutes = planTasks.reduce(
            (sum, t) => sum + (t.duration_minutes || 0),
            0
        );
        const locationName = locationNameById.get(plan.location.toString()) ?? '';
        const planIdStr = plan._id.toString();

        for (
            let cursor = new Date(start);
            cursor < end;
            cursor.setUTCDate(cursor.getUTCDate() + 1)
        ) {
            const day = new Date(cursor);
            const materialized = materializedByPlanDate.get(
                `${planIdStr}|${day.toISOString()}`
            );

            if (materialized) {
                const matchingWorkerIds = materialized.assigned_workers
                    .map((aw) => aw.worker.toString())
                    .filter((id) => workerIdSet.has(id));
                if (!matchingWorkerIds.length) continue;

                const dateKey = day.toISOString().slice(0, 10);
                const entry: RosterShiftEntry = {
                    shift_id: materialized._id.toString(),
                    is_virtual: false,
                    plan_id: planIdStr,
                    location_name: materialized.location?.name ?? locationName,
                    start_time: materialized.date_time,
                    duration_minutes: materialized.duration_minutes,
                    end_time: new Date(
                        materialized.date_time.getTime() +
                            materialized.duration_minutes * 60_000
                    ),
                    status: materialized.status,
                };
                totalShifts += 1;
                for (const workerId of matchingWorkerIds) {
                    addEntry(workerId, dateKey, entry);
                }
                continue;
            }

            if (!planTasks.length) continue;
            if (!anyPatternOccursOnDate(patterns, day)) continue;

            const matchingWorkerIds = plan.assigned_workers
                .map((aw) => aw.worker.toString())
                .filter((id) => workerIdSet.has(id));
            if (!matchingWorkerIds.length) continue;

            const dateKey = day.toISOString().slice(0, 10);
            const startTime = combineDateWithTimeOfDay(day, plan.date_time);
            const entry: RosterShiftEntry = {
                shift_id: null,
                is_virtual: true,
                plan_id: planIdStr,
                location_name: locationName,
                start_time: startTime,
                duration_minutes: virtualDurationMinutes,
                end_time: new Date(startTime.getTime() + virtualDurationMinutes * 60_000),
                status: 'upcoming',
            };
            totalShifts += 1;
            for (const workerId of matchingWorkerIds) {
                addEntry(workerId, dateKey, entry);
            }
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
 * task entry is recomputed automatically from its photo requirements — for
 * a photo-required task there is no manual complete/approve step (see
 * docs/SHIFT_MANAGEMENT_DESIGN.md). Tasks with no photo requirement are
 * NOT completed by this function — see markShiftTaskComplete.
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

    await maybeAutoCompleteShift(shift._id);

    return Shift.findById(shift._id);
};

/**
 * Worker-initiated completion for one task instance that has NO photo
 * requirement (is_photo_required: false) — these are no longer completed
 * automatically at shift creation, so the assigned worker must explicitly
 * mark them done. Rejects tasks that DO require a photo — those complete
 * only via uploadShiftTaskPhoto once every requirement is uploaded.
 */
export const markShiftTaskComplete = async (
    workerId: string,
    planId: string,
    date: Date,
    taskId: string
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

/**
 * If every task on the shift is now is_completed, auto-advances the shift's
 * own status to 'completed' — atomically, and only from
 * 'upcoming'/'in_progress' (never re-triggers, and never revives a cancelled
 * shift). A shift with no tasks at all never auto-completes this way, since
 * there's nothing to judge completion by.
 */
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

    // Only the caller that actually flips the status fires the event — a
    // shift already 'completed' (e.g. this ran again after another task
    // update) must not re-notify everyone.
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

/**
 * Shared lookup + eligibility check for check-in/check-out. Uses
 * getOrCreateShift rather than a strict findOne: materialization otherwise
 * depends entirely on the nightly cron having already run (or a manager
 * having touched the plan today), and a worker's check-in should not 404
 * just because neither happened to occur yet on this particular day (e.g.
 * the server was down at cron time). getOrCreateShift only ever creates a
 * shift when the plan's own recurrence pattern actually occurs on this date,
 * so this can't materialize a shift that shouldn't exist.
 */
const findAssignedShiftOrThrow = async (
    workerId: string,
    planId: string,
    date: Date
) => {
    const day = normalizeToUTCDateOnly(date);
    // Errors here (plan not found/inactive, or no occurrence on this date)
    // already carry accurate AppErrors of their own — let them propagate
    // rather than flattening everything into a generic "Shift not found".
    const shift = await getOrCreateShift(planId, day);
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

/**
 * Validates the worker's submitted GPS position against the shift's frozen
 * location snapshot. No time-window restriction — valid any time on the
 * shift's date, only distance is enforced. A location with no configured
 * coordinates always fails closed (geofencing can't be skipped silently).
 */
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

    // $elemMatch ties both conditions to the SAME array entry (a plain
    // dot-path pair on an array can match across different elements) and
    // makes the "not already checked in" check part of the atomic write
    // itself — not just the read above — so two concurrent check-ins from
    // the same worker can never both succeed.
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

    // The first check-in on the shift moves it out of "upcoming". Gated on
    // the shift's CURRENT status (not just "any check-in happened") so a
    // later worker checking in doesn't reopen an already completed/cancelled
    // shift, and gated atomically (status: 'upcoming' in the filter) so two
    // workers' first check-ins racing each other can't double-transition it.
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
    // Check-out is gated on the whole shift being completed (every task's
    // required photos uploaded — see maybeAutoCompleteShift) — workers stay
    // checked in until the actual cleaning work is done, then everyone
    // checks out once the shift as a whole is finished.
    if (shift.status !== 'completed') {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This shift is not completed yet — finish all tasks before checking out'
        );
    }

    const checkOutAt = new Date();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await Shift.findOneAndUpdate(
            {
                _id: shift._id,
                status: 'completed',
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
        if (!result) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                'Already checked out for this shift, or the shift is not completed yet'
            );
        }

        const worker = await Worker.findById(workerId).session(session);
        if (!worker) {
            throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
        }

        const durationHours = Math.max(
            0,
            (checkOutAt.getTime() - checkInAt.getTime()) / 3_600_000
        );
        const earnedAmount = roundToTwoDecimals(
            durationHours * worker.hourly_rate
        );

        await Worker.findByIdAndUpdate(
            workerId,
            { $inc: { total_earning: earnedAmount, pending_amount: earnedAmount } },
            { session }
        );

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

export interface PhotoReviewQueryParams {
    from?: Date;
    to?: Date;
    planId?: string;
    locationId?: string;
}

export interface PhotoReviewRow {
    cleaning_name: string;
    room_name: string;
    task_name: string;
    duration_minutes: number;
    shift_date: Date;
    location_name: string;
    address: string | null;
    uploaded_photos: { title: string; photo_url: string }[];
}

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
            const uploadedPhotos = task.photo_requirements
                .filter((p) => p.is_uploaded)
                .map((p) => ({ title: p.title, photo_url: p.photo_url as string }));
            if (!uploadedPhotos.length) continue;

            rows.push({
                cleaning_name: cleaningName,
                room_name: roomNameByRoomId.get(task.room.toString()) ?? '',
                task_name: task.name,
                duration_minutes: task.duration_minutes,
                shift_date: shift.date,
                location_name: shift.location.name,
                address,
                uploaded_photos: uploadedPhotos,
            });
        }
    }

    return rows;
};

const shiftServices = {
    listWorkerShiftsForDate,
    getOrCreateShift,
    resyncTodayShiftWorkersIfDue,
    resyncTodayShiftTasksForRoomsIfDue,
    resyncTodayShiftRoomsIfDue,
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
    getPhotoReviewListFromDB,
    assignWorkersToShift,
    updateShiftStatus,
    uploadShiftTaskPhoto,
    markShiftTaskComplete,
    checkInToShift,
    checkOutFromShift,
};

export default shiftServices;
