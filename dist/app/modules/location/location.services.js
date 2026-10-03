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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cascadeCancelPlansForLocations = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const client_model_1 = require("../client/client.model");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const shift_services_1 = require("../shift/shift.services");
const worker_model_1 = require("../worker/worker.model");
const location_model_1 = require("./location.model");
const ensureClientExists = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findOne({
        _id: clientId,
        isDeleted: false,
    });
    if (!client) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    }
    return client;
});
const ensureWorkerExists = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const worker = yield worker_model_1.Worker.findOne({ _id: workerId, isDeleted: false });
    if (!worker) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    }
    return worker;
});
const createLocationIntoDB = (managerId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield ensureClientExists(payload.client.toString());
    const result = yield location_model_1.Location.create(Object.assign(Object.assign({}, payload), { last_updated_by: managerId }));
    return result;
});
const updateLocationIntoDB = (managerId, id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const location = yield location_model_1.Location.findById(id);
    if (!location) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    }
    const result = yield location_model_1.Location.findByIdAndUpdate(id, Object.assign(Object.assign({}, payload), { last_updated_by: managerId }), {
        new: true,
        runValidators: true,
    });
    const affectedPlans = yield cleaning_plan_model_1.CleaningPlan.find({
        location: id,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('_id')
        .lean();
    yield Promise.all(affectedPlans.map((plan) => (0, shift_services_1.resyncTodayShiftLocationIfDue)(plan._id)));
    return result;
});
/**
 * Shared cascade for "these locations just went inactive": deactivates every
 * still-active CleaningPlan at any of them, deactivates those plans' chat
 * groups, and cancels their upcoming shifts (see cancelUpcomingShiftsAcrossPlans
 * for exactly which shifts that touches). Used by deleteLocationFromDB for a
 * single location, and by client.services.ts's deleteClientFromDB across every
 * location under a deleted client — one cascade, two callers, so a client
 * delete can never drift out of sync with what a location delete already does.
 * Caller owns flipping Location.is_active itself; this only handles what
 * hangs off the location(s).
 */
const cascadeCancelPlansForLocations = (locationIds, managerId, session) => __awaiter(void 0, void 0, void 0, function* () {
    if (!locationIds.length)
        return { planCount: 0, cancelledWorkerIds: [] };
    const affectedPlans = yield cleaning_plan_model_1.CleaningPlan.find({
        location: { $in: locationIds },
        is_active: true,
    })
        .select('_id')
        .session(session)
        .lean();
    const planIds = affectedPlans.map((p) => p._id);
    if (planIds.length) {
        yield cleaning_plan_model_1.CleaningPlan.updateMany({ _id: { $in: planIds } }, { is_active: false, last_updated_by: managerId }, { session });
        yield chat_services_1.default.deactivateChatGroupsForPlans(planIds, session);
    }
    const cancelledWorkerIds = yield (0, shift_services_1.cancelUpcomingShiftsAcrossPlans)(planIds, managerId, session);
    return { planCount: planIds.length, cancelledWorkerIds };
});
exports.cascadeCancelPlansForLocations = cascadeCancelPlansForLocations;
const deleteLocationFromDB = (managerId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const location = yield location_model_1.Location.findById(id);
    if (!location) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    }
    const session = yield mongoose_1.default.startSession();
    let result;
    let planCount;
    let workerIds;
    try {
        const output = yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            const updatedLocation = yield location_model_1.Location.findByIdAndUpdate(id, { is_active: false, last_updated_by: managerId }, { new: true, session });
            const { planCount, cancelledWorkerIds } = yield (0, exports.cascadeCancelPlansForLocations)([id], managerId, session);
            return {
                updatedLocation,
                planCount,
                cancelledWorkerIds,
            };
        }));
        result = output.updatedLocation;
        planCount = output.planCount;
        workerIds = output.cancelledWorkerIds;
    }
    finally {
        yield session.endSession();
    }
    (0, eventEmitter_1.emitAppEvent)('location.deactivated', {
        locationId: id,
        locationName: location.name,
        clientId: location.client.toString(),
        planCount,
        workerIds,
    });
    return result;
});
const getAllLocationsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const searchTerm = query.searchTerm;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const filters = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)) {
            filters[key] =
                key === 'client'
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
                $or: ['name', 'address'].map((field) => ({
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
                        from: 'managers',
                        localField: 'last_updated_by',
                        foreignField: '_id',
                        as: 'last_updated_by',
                    },
                },
                {
                    $unwind: {
                        path: '$last_updated_by',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'last_updated_by.user',
                        foreignField: '_id',
                        as: 'last_updated_by.user',
                    },
                },
                {
                    $unwind: {
                        path: '$last_updated_by.user',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'rooms',
                        let: { locationId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [
                                                    '$location',
                                                    '$$locationId',
                                                ],
                                            },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $count: 'count' },
                        ],
                        as: 'roomCount',
                    },
                },
                {
                    $addFields: {
                        total_room: {
                            $ifNull: [
                                { $arrayElemAt: ['$roomCount.count', 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        roomCount: 0,
                        'client.password': 0,
                        'client.isDeleted': 0,
                        'last_updated_by.user.password': 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield location_model_1.Location.aggregate(pipeline);
    const total = ((_b = (_a = aggResult === null || aggResult === void 0 ? void 0 : aggResult.metadata) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
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
const getClientLocationsFromDB = (clientId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    yield ensureClientExists(clientId);
    const searchTerm = query.searchTerm;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const filters = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)) {
            filters[key] = query[key];
        }
    });
    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';
    const pipeline = [
        {
            $match: Object.assign({ is_active: true, client: new mongoose_1.Types.ObjectId(clientId) }, filters),
        },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'address'].map((field) => ({
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
                        from: 'managers',
                        localField: 'last_updated_by',
                        foreignField: '_id',
                        as: 'last_updated_by',
                    },
                },
                {
                    $unwind: {
                        path: '$last_updated_by',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'last_updated_by.user',
                        foreignField: '_id',
                        as: 'last_updated_by.user',
                    },
                },
                {
                    $unwind: {
                        path: '$last_updated_by.user',
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: 'rooms',
                        let: { locationId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [
                                                    '$location',
                                                    '$$locationId',
                                                ],
                                            },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $count: 'count' },
                        ],
                        as: 'roomCount',
                    },
                },
                {
                    $addFields: {
                        total_room: {
                            $ifNull: [
                                { $arrayElemAt: ['$roomCount.count', 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        roomCount: 0,
                        'client.password': 0,
                        'client.isDeleted': 0,
                        'last_updated_by.user.password': 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield location_model_1.Location.aggregate(pipeline);
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
const getWorkerLocationsFromDB = (workerId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f;
    yield ensureWorkerExists(workerId);
    const locationIds = yield cleaning_plan_model_1.CleaningPlan.find({
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    }).distinct('location');
    const searchTerm = query.searchTerm;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const filters = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)) {
            filters[key] =
                key === 'client'
                    ? new mongoose_1.Types.ObjectId(query[key])
                    : query[key];
        }
    });
    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';
    const pipeline = [
        {
            $match: Object.assign({ _id: { $in: locationIds }, is_active: true }, filters),
        },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'address'].map((field) => ({
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
                        from: 'rooms',
                        let: { locationId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [
                                                    '$location',
                                                    '$$locationId',
                                                ],
                                            },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $count: 'count' },
                        ],
                        as: 'roomCount',
                    },
                },
                {
                    $addFields: {
                        total_room: {
                            $ifNull: [
                                { $arrayElemAt: ['$roomCount.count', 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        roomCount: 0,
                        'client.password': 0,
                        'client.isDeleted': 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield location_model_1.Location.aggregate(pipeline);
    const total = ((_f = (_e = aggResult === null || aggResult === void 0 ? void 0 : aggResult.metadata) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.total) || 0;
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
const getMyLocationsFromDB = (clientId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h;
    yield ensureClientExists(clientId);
    const searchTerm = query.searchTerm;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';
    const pipeline = [
        {
            $match: {
                is_active: true,
                client: new mongoose_1.Types.ObjectId(clientId),
            },
        },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'address'].map((field) => ({
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
                        from: 'rooms',
                        let: { locationId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [
                                                    '$location',
                                                    '$$locationId',
                                                ],
                                            },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $count: 'count' },
                        ],
                        as: 'roomCount',
                    },
                },
                {
                    $addFields: {
                        total_room: {
                            $ifNull: [
                                { $arrayElemAt: ['$roomCount.count', 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        roomCount: 0,
                        client: 0,
                        last_updated_by: 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield location_model_1.Location.aggregate(pipeline);
    const total = ((_h = (_g = aggResult === null || aggResult === void 0 ? void 0 : aggResult.metadata) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.total) || 0;
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
const getSingleLocationFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const [location] = yield location_model_1.Location.aggregate([
        { $match: { _id: new mongoose_1.Types.ObjectId(id) } },
        {
            $lookup: {
                from: 'clients',
                localField: 'client',
                foreignField: '_id',
                as: 'client',
            },
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'managers',
                localField: 'last_updated_by',
                foreignField: '_id',
                as: 'last_updated_by',
            },
        },
        {
            $unwind: {
                path: '$last_updated_by',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'last_updated_by.user',
                foreignField: '_id',
                as: 'last_updated_by.user',
            },
        },
        {
            $unwind: {
                path: '$last_updated_by.user',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: 'rooms',
                let: { locationId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$location', '$$locationId'] },
                                    { $eq: ['$is_active', true] },
                                ],
                            },
                        },
                    },
                    { $count: 'count' },
                ],
                as: 'roomCount',
            },
        },
        {
            $addFields: {
                total_room: {
                    $ifNull: [{ $arrayElemAt: ['$roomCount.count', 0] }, 0],
                },
            },
        },
        {
            $project: {
                roomCount: 0,
                'client.password': 0,
                'client.isDeleted': 0,
                'last_updated_by.user.password': 0,
            },
        },
    ]);
    if (!location) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    }
    return location;
});
const locationServices = {
    createLocationIntoDB,
    updateLocationIntoDB,
    deleteLocationFromDB,
    getAllLocationsFromDB,
    getClientLocationsFromDB,
    getWorkerLocationsFromDB,
    getMyLocationsFromDB,
    getSingleLocationFromDB,
};
exports.default = locationServices;
