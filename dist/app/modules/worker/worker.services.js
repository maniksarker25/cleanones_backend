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
const csvBulk_1 = require("../../utilities/csvBulk");
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
    // Best-effort, outside the transaction — idempotent, so a retry can't duplicate it.
    yield chat_services_1.default.createWorkerManagersChat(worker._id);
    return worker;
});
const WORKER_CSV_COLUMNS = [
    'name',
    'email',
    'phone',
    'worker_type',
    'position',
    'address',
    'nationality',
    'dob',
    'base_location',
    'languages',
    'working_days',
    'hourly_rate',
    'national_id',
    'password',
];
// Bulk import: one worker per CSV row, created independently (a bad row never blocks the rest).
// Reuses createWorkerIntoDB, so each worker gets the same User + profile + manager chat as a
// normal create. Like that API, no email is sent.
const bulkCreateWorkersFromCsv = (csvBuffer) => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield (0, csvBulk_1.parseCsvBuffer)(csvBuffer, [
        'name',
        'email',
        'phone',
        'worker_type',
        'password',
    ]);
    const result = {
        total: rows.length,
        created_count: 0,
        failed_count: 0,
        created: [],
        failed: [],
    };
    for (const [index, raw] of rows.entries()) {
        // +2: row 1 is the header, and spreadsheets number from 1.
        const rowNumber = index + 2;
        try {
            const row = (0, csvBulk_1.compactRow)(raw, WORKER_CSV_COLUMNS);
            const { languages, working_days, hourly_rate, worker_type } = row, rest = __rest(row, ["languages", "working_days", "hourly_rate", "worker_type"]);
            const data = worker_validation_1.default.createWorkerBody.parse(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, rest), { worker_type: worker_type
                    ? (0, csvBulk_1.matchOption)(worker_type, Object.values(worker_constant_1.WorkerType))
                    : undefined }), (languages && { languages: (0, csvBulk_1.splitList)(languages) })), (working_days && { working_days: (0, csvBulk_1.splitList)(working_days) })), (hourly_rate !== undefined && {
                hourly_rate: Number(hourly_rate),
            })), { confirmPassword: row.password }));
            const worker = yield createWorkerIntoDB(data);
            result.created.push({
                row: rowNumber,
                email: data.email,
                id: worker._id.toString(),
            });
        }
        catch (error) {
            result.failed.push({
                row: rowNumber,
                email: raw.email || undefined,
                error: (0, csvBulk_1.describeRowError)(error),
            });
        }
    }
    result.created_count = result.created.length;
    result.failed_count = result.failed.length;
    return result;
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
            // Earnings already accrued are priced at the old rate; changing it while
            // money is still owed would make that balance ambiguous. Re-sending the
            // current rate is not a change, so it is allowed.
            console.log("pending amount", worker.pending_amount, "hourly rate", data.hourly_rate, "worker hourly rate", worker.hourly_rate);
            if (data.hourly_rate !== undefined &&
                data.hourly_rate !== worker.hourly_rate &&
                worker.pending_amount >= 1) {
                throw new appError_1.default(http_status_1.default.CONFLICT, `Hourly rate can't be changed while ${roundToTwoDecimals(worker.pending_amount)} is still pending. Pay the pending amount first.`, '', {
                    pending_amount: worker.pending_amount,
                    current_hourly_rate: worker.hourly_rate,
                });
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
    // Past (completed/cancelled) shifts are history and don't block deletion;
    // anything still upcoming or in progress must be reassigned first.
    const activeShifts = yield shift_model_1.Shift.find({
        'assigned_workers.worker': id,
        status: { $in: ['upcoming', 'in_progress'] },
    })
        .select('date status cleaning_plan')
        .sort({ date: 1 })
        .lean();
    if (activeShifts.length) {
        throw new appError_1.default(http_status_1.default.CONFLICT, `This worker is still assigned to ${activeShifts.length} upcoming or in-progress shift(s). Remove the worker from those shifts before deleting.`, '', {
            shifts: activeShifts.map((shift) => ({
                shift: shift._id,
                date: shift.date,
                status: shift.status,
                cleaning_plan: shift.cleaning_plan,
            })),
        });
    }
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
/**
 * All-time shift stats for a batch of workers in one query, not one per
 * worker. late/on-time/absent are mutually exclusive — a worker who checked
 * in late was not absent.
 */
const getWorkerShiftStatsByWorker = (workerIds) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const statsByWorker = new Map();
    if (!workerIds.length)
        return statsByWorker;
    const idSet = new Set(workerIds.map((id) => id.toString()));
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const shifts = yield shift_model_1.Shift.find({
        'assigned_workers.worker': { $in: workerIds },
        status: { $ne: 'cancelled' },
    })
        .select('date date_time assigned_workers.worker assigned_workers.check_in_at')
        .lean();
    for (const shift of shifts) {
        for (const aw of shift.assigned_workers) {
            const workerId = aw.worker.toString();
            if (!idSet.has(workerId))
                continue;
            const stats = (_b = statsByWorker.get(workerId)) !== null && _b !== void 0 ? _b : ({
                total_shift: 0,
                total_late_check_ins: 0,
                total_on_time_check_ins: 0,
                total_absent: 0,
            });
            statsByWorker.set(workerId, stats);
            stats.total_shift += 1;
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
    return statsByWorker;
});
const EMPTY_WORKER_SHIFT_STATS = {
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
// Lifetime attendance stats for one worker. late = checked in after the scheduled start;
// absent = past date, status not cancelled, never checked in.
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
    validateId(id);
    const worker = yield worker_model_1.Worker.findOne(Object.assign({ _id: id }, activeWorker));
    if (!worker)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    const attendanceStats = yield getWorkerAttendanceStatsFromDB(worker._id);
    return Object.assign(Object.assign({}, worker.toObject()), attendanceStats);
});
const updateMyAvailabilityIntoDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const data = worker_validation_1.default.availabilityBody.parse(payload);
    const worker = yield worker_model_1.Worker.findOneAndUpdate(Object.assign({ user: userId }, activeWorker), { $set: { working_days: data.working_days } }, { new: true, runValidators: true });
    if (!worker) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Active worker profile not found');
    }
    return worker;
});
const getMyAvailabilityFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const worker = yield worker_model_1.Worker.findOne(Object.assign({ user: userId }, activeWorker))
        .select('working_days worker_type')
        .lean();
    if (!worker) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Active worker profile not found');
    }
    return {
        working_days: (_c = worker.working_days) !== null && _c !== void 0 ? _c : [],
        worker_type: worker.worker_type,
    };
});
exports.default = {
    bulkCreateWorkersFromCsv,
    getMyAvailabilityFromDB,
    updateMyAvailabilityIntoDB,
    createWorkerIntoDB,
    updateWorkerIntoDB,
    deleteWorkerFromDB,
    getAllWorkersFromDB,
    getSingleWorkerFromDB,
};
