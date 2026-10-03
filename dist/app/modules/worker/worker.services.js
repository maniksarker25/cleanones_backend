"use strict";
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
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const appError_1 = __importDefault(require("../../error/appError"));
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const shift_model_1 = require("../shift/shift.model");
const user_constant_1 = require("../user/user.constant");
const user_model_1 = require("../user/user.model");
const worker_model_1 = require("./worker.model");
const worker_constant_1 = require("./worker.constant");
const worker_validation_1 = __importDefault(require("./worker.validation"));
// Also include profiles created before the soft-delete field was introduced.
const activeWorker = { isDeleted: { $ne: true } };
const validateId = (id) => {
    if (!mongoose_1.default.isObjectIdOrHexString(id)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid worker ID');
    }
};
const createWorkerIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Credentials are stored only on the linked user account.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const _a = worker_validation_1.default.createWorkerBody.parse(payload), { password, confirmPassword } = _a, workerData = __rest(_a, ["password", "confirmPassword"]);
    if (workerData.working_days !== undefined &&
        workerData.worker_type !== worker_constant_1.WorkerType.Employee) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Only the manager can set working days for employees. Freelancers manage their own availability');
    }
    const session = yield mongoose_1.default.startSession();
    let worker;
    try {
        worker = yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            const existing = yield user_model_1.User.findOne({
                isDeleted: { $ne: true },
                $or: [{ email: workerData.email }, { phone: workerData.phone }],
            }).session(session);
            if (existing) {
                throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Email or phone already exists');
            }
            const [user] = yield user_model_1.User.create([
                {
                    email: workerData.email,
                    phone: workerData.phone,
                    password,
                    role: user_constant_1.USER_ROLE.worker,
                    roles: [user_constant_1.USER_ROLE.worker],
                    profileModel: user_constant_1.PROFILE_MODEL_BY_ROLE.worker,
                    isVerified: true,
                    is_admin_created: true,
                },
            ], { session });
            const [createdWorker] = yield worker_model_1.Worker.create([
                Object.assign(Object.assign({}, workerData), { user: user._id }),
            ], { session });
            yield user_model_1.User.findByIdAndUpdate(user._id, { profileId: createdWorker._id }, { session });
            return createdWorker;
        }));
    }
    finally {
        yield session.endSession();
    }
    // Best-effort, outside the transaction — same pattern as
    // createChatGroupForPlan for cleaning plans. Idempotent (unique index on
    // the chat side), so a retry here can never create a duplicate.
    yield chat_services_1.default.createWorkerManagersChat(worker._id);
    return worker;
});
const updateWorkerIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const data = worker_validation_1.default.updateWorkerBody.parse(payload);
    const session = yield mongoose_1.default.startSession();
    try {
        return yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            const worker = yield worker_model_1.Worker.findOne(Object.assign({ _id: id }, activeWorker)).session(session);
            if (!worker)
                throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
            // Manager can only set working_days for Employee-type workers.
            // Freelancers manage their own availability via /my-availability.
            if (data.working_days !== undefined &&
                worker.worker_type !== worker_constant_1.WorkerType.Employee) {
                throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Managers can only set working days for employees. Freelancers manage their own availability');
            }
            const contactFilters = [];
            if (data.email !== undefined)
                contactFilters.push({ email: data.email });
            if (data.phone !== undefined)
                contactFilters.push({ phone: data.phone });
            if (contactFilters.length) {
                const existing = yield user_model_1.User.findOne({
                    _id: { $ne: worker.user },
                    isDeleted: { $ne: true },
                    $or: contactFilters,
                }).session(session);
                if (existing) {
                    throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Email or phone already exists');
                }
                const user = yield user_model_1.User.findByIdAndUpdate(worker.user, {
                    $set: Object.assign(Object.assign({}, (data.email !== undefined && {
                        email: data.email,
                    })), (data.phone !== undefined && {
                        phone: data.phone,
                    })),
                }, { session, runValidators: true });
                if (!user)
                    throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker account not found');
            }
            return worker_model_1.Worker.findOneAndUpdate(Object.assign({ _id: id }, activeWorker), { $set: data }, { new: true, runValidators: true, session });
        }));
    }
    finally {
        yield session.endSession();
    }
});
const deleteWorkerFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const session = yield mongoose_1.default.startSession();
    try {
        yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            const worker = yield worker_model_1.Worker.findOneAndUpdate(Object.assign({ _id: id }, activeWorker), { $set: { isDeleted: true } }, { new: true, session });
            if (!worker)
                throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
            yield user_model_1.User.findByIdAndUpdate(worker.user, {
                $set: { isDeleted: true, isBlocked: true },
            }, { session });
        }));
    }
    finally {
        yield session.endSession();
    }
    yield chat_services_1.default.deactivateWorkerManagersChat(id);
    return null;
});
const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;
// All-time sum of (check_out_at - check_in_at) across every completed
// check-in, per worker, in hours — mirrors the same calculation used by
// shift.services.ts's attendance/performance endpoints, just without a date
// range since this is a lifetime total for the worker list.
const getTotalCompletedWorkHoursByWorker = (workerIds) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const hoursByWorker = new Map();
    if (!workerIds.length)
        return hoursByWorker;
    const shifts = yield shift_model_1.Shift.find({
        'assigned_workers.worker': { $in: workerIds },
    })
        .select('assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
        .lean();
    const idSet = new Set(workerIds.map((id) => id.toString()));
    const msByWorker = new Map();
    for (const shift of shifts) {
        for (const entry of shift.assigned_workers) {
            const workerId = entry.worker.toString();
            if (!idSet.has(workerId))
                continue;
            if (entry.check_in_at && entry.check_out_at) {
                msByWorker.set(workerId, ((_b = msByWorker.get(workerId)) !== null && _b !== void 0 ? _b : 0) +
                    (entry.check_out_at.getTime() - entry.check_in_at.getTime()));
            }
        }
    }
    for (const [workerId, ms] of msByWorker) {
        hoursByWorker.set(workerId, roundToTwoDecimals(ms / 3600000));
    }
    return hoursByWorker;
});
/**
 * All-time shift stats for a batch of workers, in ONE query total — not one
 * per worker — so a 100-row page (the list's max limit) costs the same
 * single round trip as a 1-row page. Mirrors
 * getTotalCompletedWorkHoursByWorker/getWorkerAttendanceStatsFromDB's
 * definitions but computes every field in a single pass over the same
 * shift/assigned_workers data instead of running separate queries for hours
 * vs. late/on-time/absent:
 * - total_shift: shifts (excluding cancelled) this worker was ever assigned to.
 * - total_late_check_ins / total_on_time_check_ins: of the shifts they
 *   actually checked into, whether check_in_at was after/at-or-before the
 *   shift's scheduled date_time. Mutually exclusive with each other.
 * - total_absent: past shifts (date before today) they were assigned to but
 *   never checked into at all — mutually exclusive with the two above (a
 *   worker who checked in, even late, was not absent).
 * - total_completed_work_hours: sum of (check_out_at - check_in_at) across
 *   every completed check-in, in hours.
 */
const getWorkerShiftStatsByWorker = (workerIds) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    const statsByWorker = new Map();
    if (!workerIds.length)
        return statsByWorker;
    const idSet = new Set(workerIds.map((id) => id.toString()));
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const shifts = yield shift_model_1.Shift.find({
        'assigned_workers.worker': { $in: workerIds },
        status: { $ne: 'cancelled' },
    })
        .select('date date_time assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
        .lean();
    const msByWorker = new Map();
    for (const shift of shifts) {
        for (const aw of shift.assigned_workers) {
            const workerId = aw.worker.toString();
            if (!idSet.has(workerId))
                continue;
            const stats = (_c = statsByWorker.get(workerId)) !== null && _c !== void 0 ? _c : ({
                total_completed_work_hours: 0,
                total_shift: 0,
                total_late_check_ins: 0,
                total_on_time_check_ins: 0,
                total_absent: 0,
            });
            statsByWorker.set(workerId, stats);
            stats.total_shift += 1;
            if (aw.check_in_at && aw.check_out_at) {
                msByWorker.set(workerId, ((_d = msByWorker.get(workerId)) !== null && _d !== void 0 ? _d : 0) +
                    (aw.check_out_at.getTime() - aw.check_in_at.getTime()));
            }
            if (aw.check_in_at) {
                if (aw.check_in_at > shift.date_time) {
                    stats.total_late_check_ins += 1;
                }
                else {
                    stats.total_on_time_check_ins += 1;
                }
            }
            else if (shift.date < today) {
                stats.total_absent += 1;
            }
        }
    }
    for (const [workerId, ms] of msByWorker) {
        const stats = statsByWorker.get(workerId);
        if (stats)
            stats.total_completed_work_hours = roundToTwoDecimals(ms / 3600000);
    }
    return statsByWorker;
});
const EMPTY_WORKER_SHIFT_STATS = {
    total_completed_work_hours: 0,
    total_shift: 0,
    total_late_check_ins: 0,
    total_on_time_check_ins: 0,
    total_absent: 0,
};
const getAllWorkersFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = worker_validation_1.default.workerListQuery.parse(query);
    const safeQuery = Object.assign(Object.assign({}, parsed), (parsed.searchTerm && {
        searchTerm: parsed.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    }));
    const workerQuery = new QueryBuilder_1.default(worker_model_1.Worker.find(activeWorker), safeQuery)
        .search(['name', 'email', 'phone', 'position', 'nationality'])
        .filter()
        .paginate()
        .sort();
    const meta = yield workerQuery.countTotal();
    const workers = (yield workerQuery.modelQuery);
    const statsByWorker = yield getWorkerShiftStatsByWorker(workers.map((worker) => worker._id));
    const result = workers.map((worker) => {
        var _a;
        return (Object.assign(Object.assign({}, worker.toObject()), ((_a = statsByWorker.get(worker._id.toString())) !== null && _a !== void 0 ? _a : EMPTY_WORKER_SHIFT_STATS)));
    });
    return { meta, result };
});
// All-time attendance stats for one worker, across every materialized shift
// they've ever been assigned to. Mirrors the late/absent definitions used by
// getWorkerPerformanceFromDB (shift.services.ts), just without the month
// filter — late: worker's own check_in_at is after the shift's scheduled
// date_time; absent: the shift's date is in the past, status isn't
// 'cancelled', and the worker never checked in.
const getWorkerAttendanceStatsFromDB = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const shifts = yield shift_model_1.Shift.find({ 'assigned_workers.worker': workerId })
        .select('date date_time status assigned_workers.worker assigned_workers.check_in_at')
        .lean();
    let completed = 0;
    let inProgress = 0;
    let late = 0;
    let absent = 0;
    for (const shift of shifts) {
        if (shift.status === 'completed')
            completed += 1;
        if (shift.status === 'in_progress')
            inProgress += 1;
        const entry = shift.assigned_workers.find((aw) => aw.worker.toString() === workerId.toString());
        if (!entry)
            continue;
        if (entry.check_in_at && entry.check_in_at > shift.date_time) {
            late += 1;
        }
        if (shift.date < today && shift.status !== 'cancelled' && !entry.check_in_at) {
            absent += 1;
        }
    }
    return {
        total_completed_shift: completed,
        total_in_progress_shift: inProgress,
        total_late_count: late,
        total_absent: absent,
    };
});
const getSingleWorkerFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    validateId(id);
    const worker = yield worker_model_1.Worker.findOne(Object.assign({ _id: id }, activeWorker));
    if (!worker)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    const [totalHours, attendanceStats] = yield Promise.all([
        getTotalCompletedWorkHoursByWorker([worker._id]),
        getWorkerAttendanceStatsFromDB(worker._id),
    ]);
    return Object.assign(Object.assign(Object.assign({}, worker.toObject()), { total_completed_work_hours: (_e = totalHours.get(worker._id.toString())) !== null && _e !== void 0 ? _e : 0 }), attendanceStats);
});
const updateMyAvailabilityIntoDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const data = worker_validation_1.default.availabilityBody.parse(payload);
    const worker = yield worker_model_1.Worker.findOneAndUpdate(Object.assign({ user: userId, worker_type: worker_constant_1.WorkerType.Freelancer }, activeWorker), { $set: { working_days: data.working_days } }, { new: true, runValidators: true });
    if (!worker) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Only active freelancers can update their own availability');
    }
    return worker;
});
exports.default = {
    updateMyAvailabilityIntoDB,
    createWorkerIntoDB,
    updateWorkerIntoDB,
    deleteWorkerFromDB,
    getAllWorkersFromDB,
    getSingleWorkerFromDB,
};
