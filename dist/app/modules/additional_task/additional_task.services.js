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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const cleaning_plan_services_1 = __importDefault(require("../cleaning_plan/cleaning_plan.services"));
const shift_services_1 = require("../shift/shift.services");
const shift_snapshot_util_1 = require("../shift/shift.snapshot.util");
const additional_task_model_1 = require("./additional_task.model");
const additional_task_validation_1 = require("./additional_task.validation");
const user_constant_1 = require("../user/user.constant");
const ensureCleaningPlanExists = (planId) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield cleaning_plan_model_1.CleaningPlan.findOne({ _id: planId, is_active: true });
    if (!plan)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    return plan;
});
// Managers have blanket access to everything manager-scoped (no persisted
// membership list anywhere in this app — same convention as chat.services.ts
// and getAllAdditionalTasksByPlanFromDB below), so ownership is only ever
// checked for the client role. Throws 404 rather than 403 so an unauthorized
// client can't distinguish "not yours" from "doesn't exist".
const ensureClientOwnsAdditionalTask = (cleaningPlanId, requester, notFoundMessage = 'Additional task not found') => __awaiter(void 0, void 0, void 0, function* () {
    if (requester.role !== user_constant_1.USER_ROLE.client)
        return;
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(cleaningPlanId).select('client').lean();
    if (!plan || plan.client.toString() !== requester.profileId) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, notFoundMessage);
    }
});
// ─── Create (Client) ──────────────────────────────────────────────────────────
const createAdditionalTaskIntoDB = (payload, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const requesterRole = requester.role;
    const plan = yield ensureCleaningPlanExists(payload.cleaning_plan_id.toString());
    if (requesterRole === user_constant_1.USER_ROLE.client &&
        plan.client.toString() !== requester.profileId) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    }
    // date_time only needs to fall on a date this plan actually has an
    // occurrence on (per its tasks' recurrence patterns) — the time-of-day
    // isn't checked against any shift's start/end window. Matches the same
    // "no occurrence on the given date" validation assignWorkersToShift and
    // listEligibleWorkersForShift already do — a materialized Shift row
    // doesn't need to exist yet (see resyncTodayShiftAdditionalTaskIfDue /
    // getOrCreateBareShift, which fold an approved additional task in
    // whenever that day's shift eventually gets created).
    const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(payload.date_time);
    if (!(0, availability_util_1.anyPatternOccursOnDate)(snapshot.patterns, day)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This cleaning plan has no occurrence on the given date');
    }
    const task = yield additional_task_model_1.AdditionalTask.create(Object.assign(Object.assign({}, payload), { is_completed: false, status: requesterRole === user_constant_1.USER_ROLE.manager ? 'Approved' : 'Pending' }));
    // A manager creating one directly is auto-approved (see status
    // above) — there's nothing pending for other managers to review, so only
    // notify when this actually came from a client request.
    if (requesterRole !== user_constant_1.USER_ROLE.manager) {
        (0, eventEmitter_1.emitAppEvent)('additional_task.created', {
            taskId: task._id.toString(),
            planId: plan._id.toString(),
            clientId: plan.client.toString(),
            name: task.name,
        });
    }
    else {
        // Auto-approved — fold it into today's shift right away if that
        // shift is already materialized, same as an explicit manager approval.
        yield (0, shift_services_1.resyncTodayShiftAdditionalTaskIfDue)(task);
    }
    return task;
});
// ─── Update (Client) ──────────────────────────────────────────────────────────
const updateAdditionalTaskIntoDB = (id, payload, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield additional_task_model_1.AdditionalTask.findById(id);
    if (!task)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Additional task not found');
    yield ensureClientOwnsAdditionalTask(task.cleaning_plan_id, requester);
    // prevent client from touching approval fields
    delete payload.status;
    delete payload.reject_reason;
    const result = yield additional_task_model_1.AdditionalTask.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
// ─── Approve (Manager) ────────────────────────────────────────────────────────
const approveAdditionalTaskIntoDB = (id, status, rejectReason, 
// Manager-adjusted duration/photo requirements, applied only when
// approving (see additional_task.validation.ts's approve schema) — lets
// the manager correct the client's proposed values as part of the same
// approval call instead of a separate update-additional-task request.
overrides) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const task = yield additional_task_model_1.AdditionalTask.findById(id);
    if (!task)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Additional task not found');
    const result = yield additional_task_model_1.AdditionalTask.findByIdAndUpdate(id, Object.assign(Object.assign({ status, 
        // Approving always clears out any reason left over from a
        // previous rejection.
        reject_reason: status === 'Rejected' ? rejectReason : null }, (status === 'Approved' && (overrides === null || overrides === void 0 ? void 0 : overrides.duration_minutes) !== undefined && {
        duration_minutes: overrides.duration_minutes,
    })), (status === 'Approved' && (overrides === null || overrides === void 0 ? void 0 : overrides.photo_requirements) !== undefined && {
        photo_requirements: overrides.photo_requirements,
        is_photo_required: overrides.photo_requirements.length > 0,
    })), { new: true, runValidators: true });
    if (result) {
        const plan = yield cleaning_plan_model_1.CleaningPlan.findById(result.cleaning_plan_id)
            .select('client')
            .lean();
        if (plan) {
            (0, eventEmitter_1.emitAppEvent)(status === 'Approved'
                ? 'additional_task.approved'
                : 'additional_task.rejected', Object.assign({ taskId: result._id.toString(), planId: result.cleaning_plan_id.toString(), clientId: plan.client.toString(), name: result.name }, (status === 'Rejected' && {
                rejectReason: (_a = result.reject_reason) !== null && _a !== void 0 ? _a : undefined,
            })));
        }
        // Newly approved (wasn't already) — fold it into that day's shift
        // right away if the shift is already materialized, instead of
        // waiting for the next materialization to pick it up.
        if (status === 'Approved' && task.status !== 'Approved') {
            yield (0, shift_services_1.resyncTodayShiftAdditionalTaskIfDue)(result);
        }
    }
    return result;
});
// ─── Delete (Client) ──────────────────────────────────────────────────────────
const deleteAdditionalTaskFromDB = (id, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield additional_task_model_1.AdditionalTask.findById(id);
    if (!task)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Additional task not found');
    yield ensureClientOwnsAdditionalTask(task.cleaning_plan_id, requester);
    yield additional_task_model_1.AdditionalTask.findByIdAndDelete(id);
    return { message: 'Additional task deleted successfully' };
});
// ─── Get all by Cleaning Plan ─────────────────────────────────────────────────
const getAllAdditionalTasksByPlanFromDB = (query, requester) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e;
    const parsed = additional_task_validation_1.additionalTaskListQuerySchema.safeParse(query);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `${issue.path.join('.')}: ${issue.message}`);
    }
    const { planId, client, searchTerm, sort } = parsed.data;
    const filters = {};
    if (planId) {
        const plan = yield ensureCleaningPlanExists(planId);
        if (requester.role === user_constant_1.USER_ROLE.client && plan.client.toString() !== requester.profileId) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
        }
        filters.cleaning_plan_id = new mongoose_1.Types.ObjectId(planId);
    }
    else if (requester.role === user_constant_1.USER_ROLE.client) {
        // Always self-scoped — the `client` query param (manager-only) is
        // never honored here, so a client can't widen their own view.
        const plans = yield cleaning_plan_model_1.CleaningPlan.find({ client: requester.profileId, is_active: true }).select('_id');
        filters.cleaning_plan_id = { $in: plans.map((plan) => plan._id) };
    }
    else if (client) {
        const plans = yield cleaning_plan_model_1.CleaningPlan.find({ client, is_active: true }).select('_id');
        // An empty $in never matches — correctly yields zero results instead
        // of accidentally falling through to "no client filter at all".
        filters.cleaning_plan_id = { $in: plans.map((plan) => plan._id) };
    }
    const page = (_b = parsed.data.page) !== null && _b !== void 0 ? _b : 1;
    const limit = (_c = parsed.data.limit) !== null && _c !== void 0 ? _c : 10;
    const skip = (page - 1) * limit;
    for (const key of ['status', 'is_completed', 'is_photo_required']) {
        if (parsed.data[key] !== undefined) {
            filters[key] = parsed.data[key];
        }
    }
    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';
    const pipeline = [
        {
            $match: Object.assign({}, filters),
        },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'description'].map((field) => ({
                    [field]: { $regex: searchTerm, $options: 'i' },
                })),
            },
        });
    }
    pipeline.push({
        $facet: {
            metadata: [{ $count: 'total' }],
            data: [
                { $sort: { [sortField]: sortOrder } },
                { $skip: skip },
                { $limit: limit },
                // Adds `cleaning_plan` (title + its location's name/address)
                // alongside the existing `cleaning_plan_id` — that field stays
                // a plain id so nothing already reading it as a string breaks.
                {
                    $lookup: {
                        from: 'cleaning_plans',
                        localField: 'cleaning_plan_id',
                        foreignField: '_id',
                        as: 'cleaning_plan',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'locations',
                                    localField: 'location',
                                    foreignField: '_id',
                                    as: 'location',
                                    pipeline: [
                                        { $project: { name: 1, address: 1 } },
                                    ],
                                },
                            },
                            {
                                $unwind: {
                                    path: '$location',
                                    preserveNullAndEmptyArrays: true,
                                },
                            },
                            { $project: { title: 1, location: 1 } },
                        ],
                    },
                },
                {
                    $unwind: {
                        path: '$cleaning_plan',
                        preserveNullAndEmptyArrays: true,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield additional_task_model_1.AdditionalTask.aggregate(pipeline);
    const total = ((_e = (_d = aggResult === null || aggResult === void 0 ? void 0 : aggResult.metadata) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.total) || 0;
    const result = (aggResult === null || aggResult === void 0 ? void 0 : aggResult.data) || [];
    return {
        meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
        result,
    };
});
// ─── Get Single ───────────────────────────────────────────────────────────────
const getSingleAdditionalTaskFromDB = (id, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield additional_task_model_1.AdditionalTask.findById(id).lean();
    if (!task)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Additional task not found');
    yield ensureClientOwnsAdditionalTask(task.cleaning_plan_id, requester);
    const cleaningPlan = yield cleaning_plan_services_1.default.getSingleCleaningPlanFromDB(task.cleaning_plan_id.toString());
    return Object.assign(Object.assign({}, task), { cleaning_plan_id: cleaningPlan });
});
// ─────────────────────────────────────────────────────────────────────────────
const additionalTaskServices = {
    createAdditionalTaskIntoDB,
    updateAdditionalTaskIntoDB,
    approveAdditionalTaskIntoDB,
    deleteAdditionalTaskFromDB,
    getAllAdditionalTasksByPlanFromDB,
    getSingleAdditionalTaskFromDB,
};
exports.default = additionalTaskServices;
