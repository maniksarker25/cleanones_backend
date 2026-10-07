import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Client } from '../client/client.model';
import { IAssignedWorker, IShift } from './shift.interface';
import { Shift } from './shift.model';
import { buildShiftSnapshot, roomsWithDueTasks, tasksOccurringOnDate } from './shift.snapshot.util';
import {
    attachWorkerNames,
    ensureActivePlan,
    getWorkerNameMap,
    resolveShiftEndTime,
} from './shift.shared.util';

export const getShiftForDate = async (
    planId: string,
    date: Date,
    requestingWorkerId?: string
) => {
    const day = normalizeToUTCDateOnly(date);
    const existing = await Shift.findOne({ cleaning_plan: planId, date: day }).lean();

    let result: (Record<string, unknown> & { assigned_workers: IAssignedWorker[] }) | null;
    if (existing) {
        const [withNames] = await attachWorkerNames([existing]);
        result = { ...withNames, end_time: resolveShiftEndTime(existing), is_virtual: false };
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

    const existingShifts = await attachWorkerNames(
        await Shift.find({
            cleaning_plan: planId,
            date: { $gte: fromDay, $lte: toDay },
        }).lean()
    );
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

/**
 * A worker's shifts for one date — plain query, no virtual projection,
 * since a worker only ever appears on a real staffed shift. Excludes
 * cancelled shifts; feeds both my-shifts and today's meta counts.
 */
export const listWorkerShiftsForDate = async (workerId: string, date: Date) => {
    const day = normalizeToUTCDateOnly(date);
    const shifts = await attachWorkerNames(
        await Shift.find({
            date: day,
            'assigned_workers.worker': workerId,
            status: { $ne: 'cancelled' },
        })
            .sort({ date_time: 1 })
            .lean()
    );
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

/**
 * Client-facing "what's happening now": every in_progress shift across this
 * client's plans, with live progress. Deliberately NOT filtered on the plan's
 * is_active — deleting a plan cancels only its upcoming shifts, so a shift
 * already underway keeps running and must stay visible until it finishes.
 */
export const getClientLiveShiftsFromDB = async (clientId: string) => {
    const planIds = await CleaningPlan.find({ client: clientId }).distinct('_id');

    const shifts = await attachWorkerNames(
        await Shift.find({
            cleaning_plan: { $in: planIds },
            status: 'in_progress',
        }).lean()
    );

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

    const absentWorkerIds = new Set<string>();
    const lateWorkerIds = new Set<string>();
    shifts.forEach((shift) => {
        shift.assigned_workers.forEach((aw) => {
            const workerId = aw.worker.toString();
            if (!aw.check_in_at) {
                if (shift.date_time <= now) absentWorkerIds.add(workerId);
            } else if (aw.check_in_at > shift.date_time) {
                lateWorkerIds.add(workerId);
            }
        });
    });

    const nameById = await getWorkerNameMap([...absentWorkerIds, ...lateWorkerIds]);
    const toWorkerRows = (workerIds: Set<string>) =>
        Array.from(workerIds, (worker_id) => ({
            worker_id,
            name: nameById.get(worker_id) ?? '',
        }));

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
        total_absent: absentWorkerIds.size,
        total_late: lateWorkerIds.size,
        absent_workers: toWorkerRows(absentWorkerIds),
        late_workers: toWorkerRows(lateWorkerIds),
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
              .select('name company_name')
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
                ? {
                      _id: plan.client._id,
                      name: plan.client.name,
                      company_name: plan.client.company_name ?? null,
                  }
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

    const [shiftWithNames] = await attachWorkerNames([shift]);
    const [result] = await attachPlanAndClient([attachProgress(shiftWithNames)]);
    return result;
};
