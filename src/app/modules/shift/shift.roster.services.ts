import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import {
    laterOf,
    normalizeToUTCDateOnly,
    occursOnDate,
    taskToPattern,
} from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Location } from '../location/location.model';
import { Task } from '../task/task.model';
import { WorkerType } from '../worker/worker.constant';
import { Worker } from '../worker/worker.model';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';
import { attachWorkerNames, resolveShiftEndTime, roundToTwoDecimals } from './shift.shared.util';

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
        })
            .lean()
            .then(attachWorkerNames),
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
