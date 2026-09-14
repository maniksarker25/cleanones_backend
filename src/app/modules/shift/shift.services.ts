import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import {
    anyPatternOccursOnDate,
    combineDateWithTimeOfDay,
    normalizeToUTCDateOnly,
} from '../cleaning_plan/availability.util';
import { IAssignedWorker } from '../cleaning_plan/cleaning_plan.interface';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Client } from '../client/client.model';
import { assertWorkersEligible } from '../worker/worker.eligibility.util';
import { Worker } from '../worker/worker.model';
import { haversineDistanceMeters } from './geo.util';
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
 * System-wide "today's shifts at a glance" — every manager sees the same
 * numbers, not scoped to who's calling. Only counts already-materialized
 * Shift documents for today — the nightly cron (plus this system's same-day
 * auto-materialization on plan create/update/assign) means today's
 * occurrences are expected to already exist by the time anyone looks at
 * this. pending maps to status 'upcoming' (not yet checked into); a
 * cancelled shift still counts toward total_shift but isn't reflected in
 * completed_shift/in_progress/pending.
 */
export const getTodayLiveShiftMetaFromDB = async () => {
    const today = normalizeToUTCDateOnly(new Date());

    const shifts = await Shift.find({ date: today }).select('status').lean();

    return {
        total_shift: shifts.length,
        completed_shift: shifts.filter((s) => s.status === 'completed').length,
        in_progress: shifts.filter((s) => s.status === 'in_progress').length,
        pending: shifts.filter((s) => s.status === 'upcoming').length,
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
    const shift = await Shift.findById(shiftId).select('tasks status').lean();
    if (!shift || !shift.tasks.length) return;
    const allTasksCompleted = shift.tasks.every((t) => t.is_completed);
    if (!allTasksCompleted) return;

    await Shift.updateOne(
        { _id: shiftId, status: { $in: ['upcoming', 'in_progress'] } },
        { $set: { status: 'completed' } }
    );
};

const GEOFENCE_RADIUS_METERS = 50;

/**
 * Shared lookup + eligibility check for check-in/check-out. Deliberately
 * does NOT call getOrCreateShift — check-in only ever applies to a shift that
 * already exists (materialized by the daily cron or an earlier manager edit).
 * There's no reason to check into a shift that hasn't happened yet, and if
 * the cron hasn't run for some reason, there's nothing to check into.
 */
const findAssignedShiftOrThrow = async (
    workerId: string,
    planId: string,
    date: Date
) => {
    const day = normalizeToUTCDateOnly(date);
    const shift = await Shift.findOne({ cleaning_plan: planId, date: day });
    if (!shift) {
        throw new AppError(httpStatus.NOT_FOUND, 'Shift not found');
    }
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
    const result = await Shift.findOneAndUpdate(
        {
            _id: shift._id,
            assigned_workers: { $elemMatch: { worker: workerId, check_in_at: null } },
        },
        {
            $set: {
                'assigned_workers.$.check_in_at': new Date(),
                'assigned_workers.$.check_in_coordinates': coordinates,
            },
        },
        { new: true }
    );
    if (!result) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already checked in for this shift');
    }

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

        return result;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const shiftServices = {
    listWorkerShiftsForDate,
    getOrCreateShift,
    getShiftForDate,
    listShiftsInRange,
    getClientLiveShiftsFromDB,
    getActiveShiftForWorker,
    getWorkerTodayMetaFromDB,
    getNextShiftForWorker,
    getTodayLiveShiftMetaFromDB,
    getTodayLiveShiftsFromDB,
    getSingleLiveShiftFromDB,
    getWorkerPerformanceFromDB,
    assignWorkersToShift,
    updateShiftStatus,
    uploadShiftTaskPhoto,
    checkInToShift,
    checkOutFromShift,
};

export default shiftServices;
