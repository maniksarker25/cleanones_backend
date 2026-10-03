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
const location_model_1 = require("../location/location.model");
const room_model_1 = require("./room.model");
const ensureLocationExists = (locationId) => __awaiter(void 0, void 0, void 0, function* () {
    const location = yield location_model_1.Location.findOne({
        _id: locationId,
        is_active: true,
    });
    if (!location) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    }
    return location;
});
const createRoomIntoDB = (managerId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield ensureLocationExists(payload.location.toString());
    const result = yield room_model_1.Room.create(Object.assign(Object.assign({}, payload), { last_updated_by: managerId }));
    return result;
});
const updateRoomIntoDB = (managerId, id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const room = yield room_model_1.Room.findById(id);
    if (!room) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Room not found');
    }
    const result = yield room_model_1.Room.findByIdAndUpdate(id, Object.assign(Object.assign({}, payload), { last_updated_by: managerId }), {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteRoomFromDB = (managerId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const room = yield room_model_1.Room.findById(id);
    if (!room) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Room not found');
    }
    const result = yield room_model_1.Room.findByIdAndUpdate(id, { is_active: false, last_updated_by: managerId }, { new: true });
    return result;
});
const getAllRoomsByLocationFromDB = (locationId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    yield ensureLocationExists(locationId);
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
            $match: Object.assign({ is_active: true, location: new mongoose_1.Types.ObjectId(locationId) }, filters),
        },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'room_type', 'cleaning_type'].map((field) => ({
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
                        from: 'locations',
                        localField: 'location',
                        foreignField: '_id',
                        as: 'location',
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
                        from: 'tasks',
                        let: { roomId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$room', '$$roomId'] },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $count: 'count' },
                        ],
                        as: 'taskCount',
                    },
                },
                {
                    $addFields: {
                        total_task: {
                            $ifNull: [
                                { $arrayElemAt: ['$taskCount.count', 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        taskCount: 0,
                        'location.client': 0,
                        'last_updated_by.user.password': 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield room_model_1.Room.aggregate(pipeline);
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
const getAllRoomsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    const searchTerm = query.searchTerm;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const matchConditions = [{ is_active: true }];
    Object.keys(query).forEach((key) => {
        if (['searchTerm', 'page', 'limit', 'sort', 'fields', 'location', 'client'].includes(key)) {
            return;
        }
        matchConditions.push({ [key]: query[key] });
    });
    if (query.location) {
        matchConditions.push({
            location: new mongoose_1.Types.ObjectId(query.location),
        });
    }
    if (query.client) {
        const clientLocationIds = yield location_model_1.Location.find({
            client: new mongoose_1.Types.ObjectId(query.client),
        }).distinct('_id');
        matchConditions.push({ location: { $in: clientLocationIds } });
    }
    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';
    const pipeline = [{ $match: { $and: matchConditions } }];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'room_type', 'cleaning_type'].map((field) => ({
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
                        from: 'locations',
                        localField: 'location',
                        foreignField: '_id',
                        as: 'location',
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
                        from: 'clients',
                        localField: 'location.client',
                        foreignField: '_id',
                        as: 'location.client',
                    },
                },
                {
                    $unwind: {
                        path: '$location.client',
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
                        from: 'tasks',
                        let: { roomId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$room', '$$roomId'] },
                                            { $eq: ['$is_active', true] },
                                        ],
                                    },
                                },
                            },
                            { $count: 'count' },
                        ],
                        as: 'taskCount',
                    },
                },
                {
                    $addFields: {
                        total_task: {
                            $ifNull: [
                                { $arrayElemAt: ['$taskCount.count', 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        taskCount: 0,
                        'location.client.password': 0,
                        'last_updated_by.user.password': 0,
                    },
                },
            ],
        },
    });
    const [aggResult] = yield room_model_1.Room.aggregate(pipeline);
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
const getMyRoomsFromDB = (clientId, locationId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const location = yield location_model_1.Location.findOne({
        _id: locationId,
        client: clientId,
        is_active: true,
    });
    if (!location) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    }
    return getAllRoomsByLocationFromDB(locationId, query);
});
const getSingleRoomFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const [room] = yield room_model_1.Room.aggregate([
        { $match: { _id: new mongoose_1.Types.ObjectId(id) } },
        {
            $lookup: {
                from: 'locations',
                localField: 'location',
                foreignField: '_id',
                as: 'location',
            },
        },
        { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
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
                from: 'tasks',
                let: { roomId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$room', '$$roomId'] },
                                    { $eq: ['$is_active', true] },
                                ],
                            },
                        },
                    },
                    { $count: 'count' },
                ],
                as: 'taskCount',
            },
        },
        {
            $addFields: {
                total_task: {
                    $ifNull: [{ $arrayElemAt: ['$taskCount.count', 0] }, 0],
                },
            },
        },
        {
            $project: {
                taskCount: 0,
                'location.client': 0,
                'last_updated_by.user.password': 0,
            },
        },
    ]);
    if (!room) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Room not found');
    }
    return room;
});
const roomServices = {
    createRoomIntoDB,
    updateRoomIntoDB,
    deleteRoomFromDB,
    getAllRoomsFromDB,
    getAllRoomsByLocationFromDB,
    getMyRoomsFromDB,
    getSingleRoomFromDB,
};
exports.default = roomServices;
