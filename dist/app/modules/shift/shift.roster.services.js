"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagerPlanRosterFromDB = exports.getPlanGroupedRosterFromDB = exports.getShiftRosterFromDB = exports.getRosterDateRange = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const location_model_1 = require("../location/location.model");
const task_model_1 = require("../task/task.model");
const worker_model_1 = require("../worker/worker.model");
const shift_model_1 = require("./shift.model");
const shift_shared_util_1 = require("./shift.shared.util");
/** [start, end) UTC bounds for the roster view. Week runs Sunday-Saturday (matches the roster UI). */
const getRosterDateRange = (view, date, year, month) => {
    if (view === 'month') {
        const now = new Date();
        const targetYear = year !== null && year !== void 0 ? year : now.getUTCFullYear();
        const targetMonth = month !== null && month !== void 0 ? month : now.getUTCMonth() + 1;
        if (targetMonth < 1 || targetMonth > 12) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'month must be between 1 and 12');
        }
        return {
            start: new Date(Date.UTC(targetYear, targetMonth - 1, 1)),
            end: new Date(Date.UTC(targetYear, targetMonth, 1)),
        };
    }
    let anchor;
    if (date) {
        anchor = (0, availability_util_1.normalizeToUTCDateOnly)(new Date(date));
        if (Number.isNaN(anchor.getTime())) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid date: ${date}`);
        }
    }
    else {
        anchor = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
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
exports.getRosterDateRange = getRosterDateRange;
/**
 * Shift Roster page: one page of active workers (filterable by name/type)
 * with their staffed shifts per date in the range. client/location narrow
 * to workers with a matching shift, and their calendar cells show only
 * matching shifts too. Pagination runs on the Worker query first (one
 * `$facet` for page + total), then Shifts are fetched only for that page.
 */
const getShiftRosterFromDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { view, date, year, month, searchTerm, workerType, client, location } = params;
    const { start, end } = (0, exports.getRosterDateRange)(view, date, year, month);
    const page = Math.max(1, Math.trunc((_a = params.page) !== null && _a !== void 0 ? _a : 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc((_b = params.limit) !== null && _b !== void 0 ? _b : 20) || 20));
    const shiftFilter = {
        date: { $gte: start, $lt: end },
        status: { $ne: 'cancelled' },
    };
    if (location !== undefined) {
        if (!mongoose_1.default.isValidObjectId(location)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid location ID');
        }
        shiftFilter['location.location'] = new mongoose_1.Types.ObjectId(location);
    }
    if (client !== undefined) {
        if (!mongoose_1.default.isValidObjectId(client)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid client ID');
        }
        const planIds = yield cleaning_plan_model_1.CleaningPlan.find({ client }).distinct('_id');
        shiftFilter.cleaning_plan = { $in: planIds };
    }
    const filteringByClientOrLocation = location !== undefined || client !== undefined;
    const workerFilter = { isDeleted: { $ne: true } };
    if (workerType)
        workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }
    if (filteringByClientOrLocation) {
        const matchingWorkerIds = yield shift_model_1.Shift.find(shiftFilter).distinct('assigned_workers.worker');
        workerFilter._id = { $in: matchingWorkerIds };
    }
    const [facet] = yield worker_model_1.Worker.aggregate([
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
    const workers = (_c = facet === null || facet === void 0 ? void 0 : facet.data) !== null && _c !== void 0 ? _c : [];
    const totalWorkers = (_f = (_e = (_d = facet === null || facet === void 0 ? void 0 : facet.totalCount) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.total) !== null && _f !== void 0 ? _f : 0;
    const totalPage = totalWorkers ? Math.ceil(totalWorkers / limit) : 0;
    const dateKeys = [];
    for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
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
    const materializedShifts = yield shift_model_1.Shift.find(Object.assign(Object.assign({}, shiftFilter), { 'assigned_workers.worker': { $in: workerIds } })).lean();
    // workerId -> dateKey -> entries
    const shiftsByWorkerDate = new Map();
    const addEntry = (workerId, dateKey, entry) => {
        let byDate = shiftsByWorkerDate.get(workerId);
        if (!byDate) {
            byDate = new Map();
            shiftsByWorkerDate.set(workerId, byDate);
        }
        const list = byDate.get(dateKey);
        if (list)
            list.push(entry);
        else
            byDate.set(dateKey, [entry]);
    };
    let totalShifts = 0;
    for (const shift of materializedShifts) {
        const matchingWorkerIds = shift.assigned_workers
            .map((aw) => aw.worker.toString())
            .filter((id) => workerIdSet.has(id));
        if (!matchingWorkerIds.length)
            continue;
        const dateKey = shift.date.toISOString().slice(0, 10);
        const entry = {
            shift_id: shift._id.toString(),
            is_virtual: false,
            plan_id: shift.cleaning_plan.toString(),
            location_name: (_h = (_g = shift.location) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : '',
            start_time: shift.date_time,
            duration_minutes: shift.duration_minutes,
            end_time: (0, shift_shared_util_1.resolveShiftEndTime)(shift),
            status: shift.status,
        };
        totalShifts += 1;
        for (const workerId of matchingWorkerIds) {
            addEntry(workerId, dateKey, entry);
        }
    }
    const workerRows = workers.map((worker) => {
        var _a;
        const workerId = worker._id.toString();
        const byDate = shiftsByWorkerDate.get(workerId);
        const shiftsByDate = {};
        let totalShiftsForWorker = 0;
        let totalMinutesForWorker = 0;
        for (const dateKey of dateKeys) {
            const entries = (_a = byDate === null || byDate === void 0 ? void 0 : byDate.get(dateKey)) !== null && _a !== void 0 ? _a : [];
            shiftsByDate[dateKey] = entries;
            totalShiftsForWorker += entries.length;
            totalMinutesForWorker += entries.reduce((sum, e) => sum + e.duration_minutes, 0);
        }
        return {
            worker_id: worker._id,
            name: worker.name,
            worker_type: worker.worker_type,
            total_shifts_in_range: totalShiftsForWorker,
            total_hours_in_range: (0, shift_shared_util_1.roundToTwoDecimals)(totalMinutesForWorker / 60),
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
});
exports.getShiftRosterFromDB = getShiftRosterFromDB;
/**
 * Roster grouped by plan: shared by the client-facing and manager-facing
 * roster endpoints (via `planFilter`). For each matching plan, every due
 * date gets either the real staffed shift or an unstaffed placeholder.
 */
const getPlanGroupedRosterFromDB = (planFilter, params) => __awaiter(void 0, void 0, void 0, function* () {
    var _j, _k;
    const { view, date, year, month } = params;
    const { start, end } = (0, exports.getRosterDateRange)(view, date, year, month);
    const page = Math.max(1, Math.trunc((_j = params.page) !== null && _j !== void 0 ? _j : 1) || 1);
    const limit = Math.min(50, Math.max(1, Math.trunc((_k = params.limit) !== null && _k !== void 0 ? _k : 10) || 10));
    const [totalPlans, plans] = yield Promise.all([
        cleaning_plan_model_1.CleaningPlan.countDocuments(planFilter),
        cleaning_plan_model_1.CleaningPlan.find(planFilter)
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
        ...new Set(plans.flatMap((p) => { var _a; return ((_a = p.tasks) !== null && _a !== void 0 ? _a : []).map((t) => t.toString()); })),
    ];
    const allLocationIds = [...new Set(plans.map((p) => p.location.toString()))];
    const [tasks, locations, materializedShifts] = yield Promise.all([
        task_model_1.Task.find({ _id: { $in: allTaskIds }, is_active: true })
            .select('room frequency_type days_of_week days_of_month duration_minutes createdAt')
            .lean(),
        location_model_1.Location.find({ _id: { $in: allLocationIds } }).select('name').lean(),
        shift_model_1.Shift.find({
            cleaning_plan: { $in: planIds },
            date: { $gte: start, $lt: end },
        })
            .lean()
            .then(shift_shared_util_1.attachWorkerNames),
    ]);
    const tasksById = new Map(tasks.map((t) => [t._id.toString(), t]));
    const locationNameById = new Map(locations.map((l) => [l._id.toString(), l.name]));
    const materializedByPlanDate = new Map(materializedShifts.map((s) => [`${s.cleaning_plan.toString()}|${s.date.toISOString()}`, s]));
    let totalShifts = 0;
    const cleaning_plans = plans.map((plan) => {
        var _a, _b;
        const planIdStr = plan._id.toString();
        const planTasks = ((_a = plan.tasks) !== null && _a !== void 0 ? _a : [])
            .map((id) => tasksById.get(id.toString()))
            .filter((t) => !!t);
        // Anchored on whichever is later, the task's or the plan's own createdAt.
        const patterns = planTasks.map((t) => (0, availability_util_1.taskToPattern)(t, (0, availability_util_1.laterOf)(t.createdAt, plan.createdAt), null));
        const locationName = (_b = locationNameById.get(plan.location.toString())) !== null && _b !== void 0 ? _b : '';
        const shifts = [];
        let totalMinutes = 0;
        for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
            const day = new Date(cursor);
            const dateKey = day.toISOString().slice(0, 10);
            const materialized = materializedByPlanDate.get(`${planIdStr}|${day.toISOString()}`);
            if (materialized) {
                const planTasksInShift = (materialized.tasks || []).filter((t) => t.source === 'plan_task' && t.room);
                const roomIds = (materialized.rooms || []).map((r) => r.room.toString());
                let completedRooms = 0;
                for (const roomId of roomIds) {
                    const tasksInRoom = planTasksInShift.filter((t) => { var _a; return ((_a = t.room) === null || _a === void 0 ? void 0 : _a.toString()) === roomId; });
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
                    end_time: (0, shift_shared_util_1.resolveShiftEndTime)(materialized),
                    duration_minutes: materialized.duration_minutes,
                    rooms: { total: roomIds.length, completed: completedRooms },
                    tasks: { total: totalTasksInShift, completed: completedTasksInShift },
                    assigned_workers: (materialized.assigned_workers || []).map((w) => {
                        var _a;
                        return ({
                            worker_id: ((_a = w.worker) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                            name: w.name,
                            role: w.role,
                        });
                    }),
                });
                totalMinutes += materialized.duration_minutes;
                totalShifts += 1;
                continue;
            }
            if (!planTasks.length)
                continue;
            const dueTasksForDay = planTasks.filter((_, i) => (0, availability_util_1.occursOnDate)(day, patterns[i]));
            if (!dueTasksForDay.length)
                continue;
            const dueRoomIds = new Set(dueTasksForDay.map((t) => t.room.toString()));
            // Due, but not yet staffed — no time or crew to show.
            const virtualDurationMinutes = dueTasksForDay.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
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
        const unassignedShiftCount = shifts.filter((s) => s.is_virtual || s.status === 'cancelled' || s.assigned_workers.length === 0).length;
        return {
            plan_id: planIdStr,
            plan_title: plan.title,
            location_name: locationName,
            total_shifts_in_range: shifts.length,
            unassigned_shift_count: unassignedShiftCount,
            total_hours_in_range: (0, shift_shared_util_1.roundToTwoDecimals)(totalMinutes / 60),
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
});
exports.getPlanGroupedRosterFromDB = getPlanGroupedRosterFromDB;
/** System-wide plan-grouped roster — same shape as GET /client/roster, filterable by client/location/title. */
const getManagerPlanRosterFromDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { client, location, searchTerm } = params, rosterParams = __rest(params, ["client", "location", "searchTerm"]);
    const planFilter = { is_active: true };
    if (client !== undefined) {
        if (!mongoose_1.default.isValidObjectId(client)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid client ID');
        }
        planFilter.client = new mongoose_1.Types.ObjectId(client);
    }
    if (location !== undefined) {
        if (!mongoose_1.default.isValidObjectId(location)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid location ID');
        }
        planFilter.location = new mongoose_1.Types.ObjectId(location);
    }
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        planFilter.title = { $regex: escaped, $options: 'i' };
    }
    return (0, exports.getPlanGroupedRosterFromDB)(planFilter, rosterParams);
});
exports.getManagerPlanRosterFromDB = getManagerPlanRosterFromDB;
