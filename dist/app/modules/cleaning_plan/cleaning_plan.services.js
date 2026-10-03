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
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const client_model_1 = require("../client/client.model");
const location_model_1 = require("../location/location.model");
const task_model_1 = require("../task/task.model");
const shift_services_1 = require("../shift/shift.services");
const cleaning_plan_model_1 = require("./cleaning_plan.model");
/**
 * Server-computed conservative upper bound: sum of duration_minutes across
 * the plan's own selected (active) tasks. Deliberately worst-case (assumes
 * every task could land on the same day) rather than a per-date-accurate
 * figure — used only as an informational estimate on the plan (see
 * max_estimated_duration); the real, authoritative duration for a specific
 * day lives on that day's materialized Shift.
 */
const computeMaxEstimatedDuration = (taskIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!taskIds.length)
        return 0;
    const tasks = yield task_model_1.Task.find({
        _id: { $in: taskIds },
        is_active: true,
    })
        .select('duration_minutes')
        .lean();
    return tasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
});
/**
 * Enforces the plan's core invariant: every selected task must belong to one
 * of the plan's own selected rooms — a task can't be picked onto a plan that
 * doesn't cover its room. Also guards against stale/invalid task ids.
 */
const validateTasksBelongToRooms = (taskIds, roomIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!taskIds.length)
        return;
    const uniqueTaskIds = [...new Set(taskIds.map(String))];
    const roomIdSet = new Set(roomIds.map(String));
    const tasks = yield task_model_1.Task.find({ _id: { $in: uniqueTaskIds } })
        .select('room')
        .lean();
    if (tasks.length !== uniqueTaskIds.length) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'One or more selected tasks do not exist');
    }
    const invalid = tasks.some((t) => !roomIdSet.has(t.room.toString()));
    if (invalid) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "One or more selected tasks do not belong to this plan's selected rooms");
    }
});
/**
 * Drops any previously-selected task whose room no longer appears in the
 * plan's (just-updated) room list — called when `rooms` changes on an update
 * that doesn't also explicitly replace `tasks` in the same payload, so a
 * removed room can never leave an orphaned task id behind on the plan.
 */
const pruneTasksForRemovedRooms = (taskIds, roomIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!taskIds.length)
        return [];
    const roomIdSet = new Set(roomIds.map(String));
    const tasks = yield task_model_1.Task.find({ _id: { $in: taskIds } })
        .select('room')
        .lean();
    const keepTaskIdSet = new Set(tasks
        .filter((t) => roomIdSet.has(t.room.toString()))
        .map((t) => t._id.toString()));
    return taskIds
        .map(String)
        .filter((id) => keepTaskIdSet.has(id))
        .map((id) => new mongoose_1.Types.ObjectId(id));
});
const ensureClientExists = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findOne({ _id: clientId, isDeleted: false });
    if (!client)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    return client;
});
const ensureLocationExists = (locationId) => __awaiter(void 0, void 0, void 0, function* () {
    const location = yield location_model_1.Location.findOne({
        _id: locationId,
        is_active: true,
    });
    if (!location)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    return location;
});
const createCleaningPlanIntoDB = (managerId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    yield ensureClientExists(payload.client.toString());
    yield ensureLocationExists(payload.location.toString());
    const rooms = (_a = payload.rooms) !== null && _a !== void 0 ? _a : [];
    const tasks = (_b = payload.tasks) !== null && _b !== void 0 ? _b : [];
    yield validateTasksBelongToRooms(tasks, rooms);
    const max_estimated_duration = yield computeMaxEstimatedDuration(tasks);
    const result = yield cleaning_plan_model_1.CleaningPlan.create(Object.assign(Object.assign({}, payload), { rooms,
        tasks,
        max_estimated_duration, manager: managerId, last_updated_by: managerId }));
    yield chat_services_1.default.createChatGroupForPlan(result);
    (0, eventEmitter_1.emitAppEvent)('cleaning_plan.created', {
        planId: result._id.toString(),
        title: result.title,
        clientId: result.client.toString(),
        managerId,
    });
    return result;
});
const updateCleaningPlanIntoDB = (managerId, id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(id);
    if (!plan)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    const { rooms, tasks } = payload, rest = __rest(payload, ["rooms", "tasks"]);
    const update = Object.assign(Object.assign({}, rest), { last_updated_by: managerId });
    const effectiveRooms = rooms !== undefined ? rooms : plan.rooms;
    let effectiveTasks = tasks !== undefined ? tasks : plan.tasks;
    if (tasks !== undefined) {
        // Manager explicitly set the task selection on this update — must
        // belong to whichever room list is in effect after this same edit.
        yield validateTasksBelongToRooms(tasks, effectiveRooms);
    }
    else if (rooms !== undefined) {
        // Rooms changed but tasks weren't touched in this payload — drop any
        // previously-selected task whose room just fell out of the plan.
        effectiveTasks = yield pruneTasksForRemovedRooms(plan.tasks, rooms);
    }
    if (rooms !== undefined) {
        update.rooms = rooms;
    }
    if (rooms !== undefined || tasks !== undefined) {
        update.tasks = effectiveTasks;
        update.max_estimated_duration = yield computeMaxEstimatedDuration(effectiveTasks);
    }
    const result = yield cleaning_plan_model_1.CleaningPlan.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
    });
    // A room/task change on the plan needs today's already-materialized
    // shift (if any) resynced — otherwise it keeps showing whatever
    // rooms/tasks existed at staffing time until someone re-visits it.
    if (result && (rooms !== undefined || tasks !== undefined)) {
        yield (0, shift_services_1.resyncTodayShiftRoomsIfDue)(result._id, result.rooms, result.tasks);
    }
    return result;
});
// ─── Delete (soft) ─────────────────────────────────────────────────────────────
const deleteCleaningPlanFromDB = (managerId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(id);
    if (!plan)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    // The plan flip, its chat group, and cancelling its future shifts must
    // land together or not at all — a crash mid-cascade must never leave a
    // "deleted" plan with a shift still 'upcoming' and staffable. Events are
    // deliberately fired AFTER the transaction commits, never inside it:
    // they're external side effects (notifications), not data that needs to
    // roll back, and must never fire for a write that didn't actually land.
    const session = yield mongoose_1.default.startSession();
    let result;
    let workerIds;
    try {
        const output = yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            const updated = yield cleaning_plan_model_1.CleaningPlan.findByIdAndUpdate(id, { is_active: false, last_updated_by: managerId }, { new: true, session });
            yield chat_services_1.default.deactivateChatGroupForPlan(id, session);
            const cancelledWorkerIds = yield (0, shift_services_1.cancelUpcomingShiftsAcrossPlans)([id], managerId, session);
            return { updated, cancelledWorkerIds };
        }));
        result = output.updated;
        workerIds = output.cancelledWorkerIds;
    }
    finally {
        yield session.endSession();
    }
    (0, eventEmitter_1.emitAppEvent)('cleaning_plan.deleted', {
        planId: id,
        title: plan.title,
        clientId: plan.client.toString(),
    });
    if (workerIds.length) {
        (0, eventEmitter_1.emitAppEvent)('cleaning_plan.shifts_cancelled', {
            planId: id,
            title: plan.title,
            workerIds,
        });
    }
    return result;
});
// ─── Get All ───────────────────────────────────────────────────────────────────
const getMyCleaningPlansFromDB = (clientId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedQuery = {};
    for (const key of ['page', 'limit', 'searchTerm', 'sort', 'location']) {
        if (query[key] !== undefined) {
            if (typeof query[key] !== 'string') {
                throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid ${key}`);
            }
            allowedQuery[key] = query[key];
        }
    }
    for (const key of ['page', 'limit']) {
        if (allowedQuery[key] !== undefined) {
            const value = Number(allowedQuery[key]);
            if (!Number.isSafeInteger(value) || value < 1) {
                throw new appError_1.default(http_status_1.default.BAD_REQUEST, `${key} must be a positive integer`);
            }
        }
    }
    if (allowedQuery.location && !mongoose_1.Types.ObjectId.isValid(allowedQuery.location)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid location ID');
    }
    return getAllCleaningPlansFromDB(Object.assign(Object.assign({}, allowedQuery), { client: clientId, is_active: true }));
});
const getAllCleaningPlansFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    const searchTerm = query.searchTerm;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const filters = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)) {
            filters[key] =
                key === 'client' || key === 'location'
                    ? new mongoose_1.Types.ObjectId(query[key])
                    : query[key];
        }
    });
    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';
    const pipeline = [
        { $match: Object.assign({ is_active: true }, filters) },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['title', 'description'].map((field) => ({
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
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'client',
                        foreignField: '_id',
                        as: 'client',
                        pipeline: [
                            {
                                $project: {
                                    password: 0,
                                    isDeleted: 0,
                                },
                            },
                        ],
                    },
                },
                {
                    $unwind: {
                        path: '$client',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'locations',
                        localField: 'location',
                        foreignField: '_id',
                        as: 'location',
                        pipeline: [
                            {
                                $project: {
                                    client: 0,
                                    last_updated_by: 0,
                                },
                            },
                        ],
                    },
                },
                {
                    $unwind: {
                        path: '$location',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'tasks',
                        let: { planTasks: { $ifNull: ['$tasks', []] } },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $in: ['$_id', '$$planTasks'] },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $project: { _id: 1 } },
                        ],
                        as: '_planTasks',
                    },
                },
                {
                    $lookup: {
                        from: 'additionaltasks',
                        localField: '_id',
                        foreignField: 'cleaning_plan_id',
                        as: '_additionalTasks',
                        pipeline: [{ $project: { _id: 1 } }],
                    },
                },
                {
                    $addFields: {
                        total_room: { $size: { $ifNull: ['$rooms', []] } },
                        total_additional_task: { $size: '$_additionalTasks' },
                        total_tasks: { $size: '$_planTasks' },
                        total_task: { $size: '$_planTasks' },
                    },
                },
                {
                    $lookup: {
                        from: 'managers',
                        localField: 'manager',
                        foreignField: '_id',
                        as: 'manager',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user',
                                    foreignField: '_id',
                                    as: 'user',
                                    pipeline: [
                                        { $project: { password: 0 } },
                                    ],
                                },
                            },
                            {
                                $unwind: {
                                    path: '$user',
                                    preserveNullAndEmptyArrays: true,
                                },
                            },
                        ],
                    },
                },
                {
                    $unwind: {
                        path: '$manager',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'managers',
                        localField: 'last_updated_by',
                        foreignField: '_id',
                        as: 'last_updated_by',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user',
                                    foreignField: '_id',
                                    as: 'user',
                                    pipeline: [
                                        { $project: { password: 0 } },
                                    ],
                                },
                            },
                            {
                                $unwind: {
                                    path: '$user',
                                    preserveNullAndEmptyArrays: true,
                                },
                            },
                        ],
                    },
                },
                {
                    $unwind: {
                        path: '$last_updated_by',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $project: {
                        rooms: 0,
                        _planTasks: 0,
                        _additionalTasks: 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield cleaning_plan_model_1.CleaningPlan.aggregate(pipeline);
    const total = ((_d = (_c = aggResult === null || aggResult === void 0 ? void 0 : aggResult.metadata) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.total) || 0;
    const result = (aggResult === null || aggResult === void 0 ? void 0 : aggResult.data) || [];
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
// ─── Get Single ────────────────────────────────────────────────────────────────
const getSingleCleaningPlanFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const [plan] = yield cleaning_plan_model_1.CleaningPlan.aggregate([
        { $match: { _id: new mongoose_1.Types.ObjectId(id) } },
        {
            $lookup: {
                from: 'clients',
                localField: 'client',
                foreignField: '_id',
                as: 'client',
                pipeline: [{ $project: { password: 0, isDeleted: 0 } }],
            },
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'locations',
                localField: 'location',
                foreignField: '_id',
                as: 'location',
                pipeline: [
                    { $project: { client: 0, last_updated_by: 0 } },
                ],
            },
        },
        { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'rooms',
                let: {
                    roomIds: { $ifNull: ['$rooms', []] },
                    planTaskIds: { $ifNull: ['$tasks', []] },
                },
                pipeline: [
                    { $match: { $expr: { $in: ['$_id', '$$roomIds'] } } },
                    { $project: { location: 0, last_updated_by: 0 } },
                    {
                        // Only this plan's OWN selected tasks under the
                        // room — not every active task the room has — so a
                        // second plan covering the same room with a
                        // different task subset reports its own counts.
                        $lookup: {
                            from: 'tasks',
                            let: { roomId: '$_id', planTaskIds: '$$planTaskIds' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$room', '$$roomId'] },
                                                { $in: ['$_id', '$$planTaskIds'] },
                                                { $eq: ['$is_active', true] },
                                            ],
                                        },
                                    },
                                },
                            ],
                            as: 'tasks',
                        },
                    },
                    {
                        $addFields: {
                            total_task: { $size: { $ifNull: ['$tasks', []] } },
                            total_duration: { $sum: '$tasks.duration_minutes' },
                        },
                    },
                ],
                as: 'rooms',
            },
        },
        {
            $lookup: {
                from: 'additionaltasks',
                localField: '_id',
                foreignField: 'cleaning_plan_id',
                as: 'additional_tasks',
            },
        },
        {
            $addFields: {
                total_rooms: { $size: { $ifNull: ['$rooms', []] } },
                total_tasks: { $sum: '$rooms.total_task' },
                // Sum of the recurring room tasks' duration_minutes only —
                // the plan's regular checklist, excluding ad-hoc work.
                total_task_duration: { $sum: '$rooms.total_duration' },
                // Sum across every AdditionalTask regardless of status —
                // same "unfiltered" convention as total_additional_tasks_pending below.
                total_additional_task_duration: {
                    $sum: { $ifNull: ['$additional_tasks.duration_minutes', []] },
                },
                total_additional_tasks_pending: {
                    $size: {
                        $filter: {
                            input: { $ifNull: ['$additional_tasks', []] },
                            as: 'task',
                            cond: { $eq: ['$$task.is_completed', false] },
                        },
                    },
                },
            },
        },
        {
            // Grand total: regular checklist time + ad-hoc task time
            // combined — split into its own stage so it can reference the
            // two fields computed just above.
            $addFields: {
                total_duration: {
                    $add: ['$total_task_duration', '$total_additional_task_duration'],
                },
            },
        },
        {
            $lookup: {
                from: 'managers',
                localField: 'manager',
                foreignField: '_id',
                as: 'manager',
                pipeline: [{ $project: { user: 0 } }],
            },
        },
        {
            $unwind: {
                path: '$manager',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: 'managers',
                localField: 'last_updated_by',
                foreignField: '_id',
                as: 'last_updated_by',
                pipeline: [{ $project: { user: 0 } }],
            },
        },
        {
            $unwind: {
                path: '$last_updated_by',
                preserveNullAndEmptyArrays: true,
            },
        },
    ]);
    if (!plan)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    return plan;
});
// ───────────────────────────────────────────────────────────────────────────────
const cleaningPlanServices = {
    getMyCleaningPlansFromDB,
    createCleaningPlanIntoDB,
    updateCleaningPlanIntoDB,
    deleteCleaningPlanFromDB,
    getAllCleaningPlansFromDB,
    getSingleCleaningPlanFromDB,
};
exports.default = cleaningPlanServices;
