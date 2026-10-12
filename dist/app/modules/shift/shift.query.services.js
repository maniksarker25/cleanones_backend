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
exports.getSingleLiveShiftFromDB = exports.getTodayLiveShiftsFromDB = exports.getTodayLiveShiftMetaFromDB = exports.getNextShiftForWorker = exports.getWorkerTodayMetaFromDB = exports.getActiveShiftForWorker = exports.getClientLiveShiftsFromDB = exports.listWorkerShiftsForDate = exports.listShiftsInRange = exports.getShiftForDate = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const client_model_1 = require("../client/client.model");
const shift_model_1 = require("./shift.model");
const shift_snapshot_util_1 = require("./shift.snapshot.util");
const shift_shared_util_1 = require("./shift.shared.util");
const getShiftForDate = (planId, date, requestingWorkerId) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const existing = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day }).lean();
    let result;
    if (existing) {
        const [withNames] = yield (0, shift_shared_util_1.attachWorkerNames)([existing]);
        result = Object.assign(Object.assign({}, withNames), { end_time: (0, shift_shared_util_1.resolveShiftEndTime)(existing), is_virtual: false });
    }
    else {
        const plan = yield (0, shift_shared_util_1.ensureActivePlan)(planId);
        const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
        const dueTasks = (0, shift_snapshot_util_1.tasksOccurringOnDate)(snapshot, day);
        result = dueTasks.length
            ? {
                cleaning_plan: plan._id,
                date: day,
                location: snapshot.location,
                rooms: (0, shift_snapshot_util_1.roomsWithDueTasks)(snapshot.rooms, dueTasks),
                tasks: dueTasks,
                duration_minutes: dueTasks.reduce((sum, t) => sum + t.duration_minutes, 0),
                assigned_workers: [],
                status: 'unstaffed',
                is_virtual: true,
            }
            : null;
    }
    if (result &&
        requestingWorkerId &&
        !result.assigned_workers.some((aw) => aw.worker.toString() === requestingWorkerId)) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not assigned to this shift');
    }
    return result;
});
exports.getShiftForDate = getShiftForDate;
/**
 * Every occurrence of the plan in [from, to]: the materialized shift where
 * one exists, otherwise an unstaffed placeholder for dates the plan is due.
 */
const listShiftsInRange = (planId, from, to) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield (0, shift_shared_util_1.ensureActivePlan)(planId);
    const fromDay = (0, availability_util_1.normalizeToUTCDateOnly)(from);
    const toDay = (0, availability_util_1.normalizeToUTCDateOnly)(to);
    if (toDay < fromDay) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, '`to` must not be before `from`');
    }
    const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
    const existingShifts = yield (0, shift_shared_util_1.attachWorkerNames)(yield shift_model_1.Shift.find({
        cleaning_plan: planId,
        date: { $gte: fromDay, $lte: toDay },
    }).lean());
    const existingByDate = new Map(existingShifts.map((s) => [s.date.toISOString(), s]));
    const results = [];
    for (let cursor = new Date(fromDay); cursor <= toDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const day = new Date(cursor);
        const existing = existingByDate.get(day.toISOString());
        if (existing) {
            results.push(Object.assign(Object.assign({}, existing), { end_time: (0, shift_shared_util_1.resolveShiftEndTime)(existing), is_virtual: false }));
            continue;
        }
        const dueTasks = (0, shift_snapshot_util_1.tasksOccurringOnDate)(snapshot, day);
        if (!dueTasks.length)
            continue;
        results.push({
            cleaning_plan: plan._id,
            date: day,
            location: snapshot.location,
            rooms: (0, shift_snapshot_util_1.roomsWithDueTasks)(snapshot.rooms, dueTasks),
            tasks: dueTasks,
            duration_minutes: dueTasks.reduce((sum, t) => sum + t.duration_minutes, 0),
            assigned_workers: [],
            status: 'unstaffed',
            is_virtual: true,
        });
    }
    return results;
});
exports.listShiftsInRange = listShiftsInRange;
/**
 * A worker's shifts for one date — plain query, no virtual projection,
 * since a worker only ever appears on a real staffed shift. Excludes
 * cancelled shifts; feeds both my-shifts and today's meta counts.
 */
const listWorkerShiftsForDate = (workerId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const shifts = yield (0, shift_shared_util_1.attachWorkerNames)(yield shift_model_1.Shift.find({
        date: day,
        'assigned_workers.worker': workerId,
        status: { $ne: 'cancelled' },
    })
        .sort({ date_time: 1 })
        .lean());
    return shifts.map((shift) => (Object.assign(Object.assign({}, shift), { end_time: (0, shift_shared_util_1.resolveShiftEndTime)(shift), is_virtual: false })));
});
exports.listWorkerShiftsForDate = listWorkerShiftsForDate;
/**
 * Per-room progress = completed/total tasks in that room; overall progress
 * is the average across rooms, so one large room can't drown out a small one.
 */
const attachProgress = (shift) => {
    const rooms = shift.rooms.map((room) => {
        const roomTasks = shift.tasks.filter((t) => t.room && t.room.toString() === room.room.toString());
        const completedTask = roomTasks.filter((t) => t.is_completed).length;
        const totalTask = roomTasks.length;
        return Object.assign(Object.assign({}, room), { total_task: totalTask, completed_task: completedTask, progress_percent: totalTask
                ? Math.round((completedTask / totalTask) * 100)
                : 0 });
    });
    const overallProgressPercent = rooms.length
        ? Math.round(rooms.reduce((sum, r) => sum + r.progress_percent, 0) / rooms.length)
        : 0;
    return Object.assign(Object.assign({}, shift), { end_time: (0, shift_shared_util_1.resolveShiftEndTime)(shift), rooms, total_room: shift.rooms.length, completed_room: rooms.filter((r) => r.progress_percent === 100).length, total_task: shift.tasks.length, overall_progress_percent: overallProgressPercent });
};
/**
 * Client-facing "what's happening now": every in_progress shift across this
 * client's plans, with live progress. Deliberately NOT filtered on the plan's
 * is_active — deleting a plan cancels only its upcoming shifts, so a shift
 * already underway keeps running and must stay visible until it finishes.
 */
const getClientLiveShiftsFromDB = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const planIds = yield cleaning_plan_model_1.CleaningPlan.find({ client: clientId }).distinct('_id');
    const shifts = yield (0, shift_shared_util_1.attachWorkerNames)(yield shift_model_1.Shift.find({
        cleaning_plan: { $in: planIds },
        status: 'in_progress',
    }).lean());
    return shifts.map((shift) => {
        const _a = attachProgress(shift), { tasks } = _a, withoutTasks = __rest(_a, ["tasks"]);
        return withoutTasks;
    });
});
exports.getClientLiveShiftsFromDB = getClientLiveShiftsFromDB;
const getActiveShiftForWorker = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const shift = yield shift_model_1.Shift.findOne({
        status: 'in_progress',
        assigned_workers: {
            $elemMatch: {
                worker: workerId,
                check_in_at: { $ne: null },
                check_out_at: null,
            },
        },
    }).lean();
    if (!shift)
        return {};
    const _b = attachProgress(shift), { tasks, rooms, assigned_workers } = _b, rest = __rest(_b, ["tasks", "rooms", "assigned_workers"]);
    const own = assigned_workers.find((aw) => aw.worker.toString() === workerId);
    return Object.assign(Object.assign({}, rest), { check_in_at: (_a = own === null || own === void 0 ? void 0 : own.check_in_at) !== null && _a !== void 0 ? _a : null });
});
exports.getActiveShiftForWorker = getActiveShiftForWorker;
const getWorkerTodayMetaFromDB = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const shifts = yield (0, exports.listWorkerShiftsForDate)(workerId, new Date());
    const total = shifts.length;
    const completed = shifts.filter((s) => s.status === 'completed').length;
    return {
        total_shift: total,
        completed,
        pending: total - completed,
    };
});
exports.getWorkerTodayMetaFromDB = getWorkerTodayMetaFromDB;
const getNextShiftForWorker = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const materialized = yield shift_model_1.Shift.findOne({
        'assigned_workers.worker': workerId,
        status: 'upcoming',
        date_time: { $gt: now },
    })
        .sort({ date_time: 1 })
        .lean();
    if (!materialized)
        return {};
    const { tasks, rooms, assigned_workers } = materialized, rest = __rest(materialized, ["tasks", "rooms", "assigned_workers"]);
    return Object.assign(Object.assign({}, rest), { end_time: (0, shift_shared_util_1.resolveShiftEndTime)(materialized), is_virtual: false });
});
exports.getNextShiftForWorker = getNextShiftForWorker;
/**
 * Dashboard-wide "today at a glance" — same for every manager, not scoped
 * to the caller. Only counts already-materialized shifts (the daily cron
 * guarantees today's exist by now). total_absent/total_late are
 * point-in-time: absent = past start, never checked in; late = checked in
 * after the scheduled start. Mutually exclusive, both exclude cancelled shifts.
 */
const getTodayLiveShiftMetaFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const now = new Date();
    const allShifts = yield shift_model_1.Shift.find({ date: today })
        .select('status date_time assigned_workers')
        .lean();
    const shifts = allShifts.filter((s) => s.status !== 'cancelled');
    const absentWorkerIds = new Set();
    const lateWorkerIds = new Set();
    shifts.forEach((shift) => {
        shift.assigned_workers.forEach((aw) => {
            const workerId = aw.worker.toString();
            if (!aw.check_in_at) {
                if (shift.date_time <= now)
                    absentWorkerIds.add(workerId);
            }
            else if (aw.check_in_at > shift.date_time) {
                lateWorkerIds.add(workerId);
            }
        });
    });
    const nameById = yield (0, shift_shared_util_1.getWorkerNameMap)([...absentWorkerIds, ...lateWorkerIds]);
    const toWorkerRows = (workerIds) => Array.from(workerIds, (worker_id) => {
        var _a;
        return ({
            worker_id,
            name: (_a = nameById.get(worker_id)) !== null && _a !== void 0 ? _a : '',
        });
    });
    return {
        today_total_shift: shifts.length,
        today_total_completed_shift: shifts.filter((s) => s.status === 'completed').length,
        today_total_in_progress_shift: shifts.filter((s) => s.status === 'in_progress').length,
        today_total_pending_shift: shifts.filter((s) => s.status === 'upcoming').length,
        total_absent: absentWorkerIds.size,
        total_late: lateWorkerIds.size,
        absent_workers: toWorkerRows(absentWorkerIds),
        late_workers: toWorkerRows(lateWorkerIds),
    };
});
exports.getTodayLiveShiftMetaFromDB = getTodayLiveShiftMetaFromDB;
const MAX_PAGE_SIZE = 100;
const parseObjectIdQueryParam = (value, fieldName) => {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value !== 'string' || !mongoose_1.default.isValidObjectId(value)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid ${fieldName}`);
    }
    return new mongoose_1.Types.ObjectId(value);
};
// Batch-resolves plan/client info for a set of shifts in two queries total, not one per shift.
const attachPlanAndClient = (shifts) => __awaiter(void 0, void 0, void 0, function* () {
    if (!shifts.length)
        return [];
    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const plans = yield cleaning_plan_model_1.CleaningPlan.find({ _id: { $in: planIds } })
        .select('title client')
        .lean();
    const clientIds = [...new Set(plans.map((p) => p.client.toString()))];
    const clients = clientIds.length
        ? yield client_model_1.Client.find({ _id: { $in: clientIds } })
            .select('name company_name')
            .lean()
        : [];
    const clientById = new Map(clients.map((c) => [c._id.toString(), c]));
    const planById = new Map(plans.map((p) => {
        var _a;
        return [
            p._id.toString(),
            {
                _id: p._id,
                title: p.title,
                client: (_a = clientById.get(p.client.toString())) !== null && _a !== void 0 ? _a : null,
            },
        ];
    }));
    return shifts.map((shift) => {
        var _a;
        const plan = planById.get(shift.cleaning_plan.toString());
        const { cleaning_plan } = shift, rest = __rest(shift, ["cleaning_plan"]);
        return Object.assign(Object.assign({}, rest), { cleaning_plan: plan
                ? { _id: plan._id, title: plan.title }
                : { _id: cleaning_plan, title: null }, client: (plan === null || plan === void 0 ? void 0 : plan.client)
                ? {
                    _id: plan.client._id,
                    name: plan.client.name,
                    company_name: (_a = plan.client.company_name) !== null && _a !== void 0 ? _a : null,
                }
                : null });
    });
});
// Allowlisted so a caller can't force a sort on an unindexed path.
const TODAY_LIVE_SHIFTS_SORTABLE_FIELDS = new Set([
    'date_time',
    'status',
    'createdAt',
    'updatedAt',
]);
// 'cancelled' is deliberately not a valid filter value here — today's live shifts never includes it.
const SHIFT_STATUSES = new Set([
    'upcoming',
    'in_progress',
    'completed',
]);
/** Manager-facing today's-shifts list, system-wide, filterable by location/client. Room detail lives on the single-shift endpoint. */
const getTodayLiveShiftsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const sortOrder = (sort === null || sort === void 0 ? void 0 : sort.startsWith('-')) ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'date_time';
    if (!TODAY_LIVE_SHIFTS_SORTABLE_FIELDS.has(sortField)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid sort field. Allowed: ${[...TODAY_LIVE_SHIFTS_SORTABLE_FIELDS].join(', ')}`);
    }
    const match = { date: today, status: { $ne: 'cancelled' } };
    const locationId = parseObjectIdQueryParam(query.location, 'location');
    if (locationId) {
        match['location.location'] = locationId;
    }
    const clientId = parseObjectIdQueryParam(query.client, 'client');
    if (clientId) {
        const planIds = yield cleaning_plan_model_1.CleaningPlan.find({ client: clientId }).distinct('_id');
        match.cleaning_plan = { $in: planIds };
    }
    if (query.status !== undefined && query.status !== '') {
        if (!SHIFT_STATUSES.has(query.status)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid status. Allowed: ${[...SHIFT_STATUSES].join(', ')}`);
        }
        match.status = query.status;
    }
    const [shifts, total] = yield Promise.all([
        shift_model_1.Shift.find(match)
            // _id tiebreaker keeps pagination stable when sortField ties.
            .sort({ [sortField]: sortOrder, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        shift_model_1.Shift.countDocuments(match),
    ]);
    const withProgress = shifts.map((shift) => {
        const _a = attachProgress(shift), { tasks, rooms, assigned_workers } = _a, rest = __rest(_a, ["tasks", "rooms", "assigned_workers"]);
        return rest;
    });
    const result = yield attachPlanAndClient(withProgress);
    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
});
exports.getTodayLiveShiftsFromDB = getTodayLiveShiftsFromDB;
/** One shift's full detail — tasks, rooms with progress, crew, plan/client context. */
const getSingleLiveShiftFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.isValidObjectId(id)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid shift ID');
    }
    const shift = yield shift_model_1.Shift.findById(id).lean();
    if (!shift) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Shift not found');
    }
    const [shiftWithNames] = yield (0, shift_shared_util_1.attachWorkerNames)([shift]);
    const [result] = yield attachPlanAndClient([attachProgress(shiftWithNames)]);
    return result;
});
exports.getSingleLiveShiftFromDB = getSingleLiveShiftFromDB;
