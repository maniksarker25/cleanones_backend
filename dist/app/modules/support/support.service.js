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
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const notification_enum_1 = require("../notification/notification.enum");
const notification_model_1 = __importDefault(require("../notification/notification.model"));
const support_enum_1 = require("./support.enum");
const support_model_1 = require("./support.model");
const createSupport = (userData, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userModel = userData.role === 'customer'
        ? 'Customer'
        : userData.role === 'bartender'
            ? 'Bartender'
            : 'VenueOwner';
    const supportData = Object.assign(Object.assign({}, payload), { user: userData.profileId, userModel });
    const result = yield support_model_1.Support.create(supportData);
    const data = {
        receiver: 'admin',
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SUPPORT_CREATED,
        title: 'A new support created',
        message: 'A new support created , please resolved it',
        data: {
            entity: notification_enum_1.NOTIFICATION_ENTITY.SUPPORT,
            action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
            entityId: result._id,
            meta: {
                customerName: 'Manik Sarker',
                priority: 'high',
            },
        },
    };
    notification_model_1.default.create(data);
    return result;
});
const getAllSupport = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchTerm = query.searchTerm || '';
    const filters = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit'].includes(key)) {
            filters[key] = query[key];
        }
    });
    const pipeline = [
        {
            $match: filters,
        },
        {
            $lookup: {
                from: 'customers',
                localField: 'user',
                foreignField: '_id',
                as: 'customer',
            },
        },
        {
            $lookup: {
                from: 'providers',
                localField: 'user',
                foreignField: '_id',
                as: 'provider',
            },
        },
        {
            $addFields: {
                userDetails: {
                    $switch: {
                        branches: [
                            {
                                case: { $eq: ['$userModel', 'Customer'] },
                                then: {
                                    $let: {
                                        vars: {
                                            user: {
                                                $arrayElemAt: ['$customer', 0],
                                            },
                                        },
                                        in: {
                                            _id: '$$user._id',
                                            name: '$$user.name',
                                            email: '$$user.email',
                                            profile_image: '$$user.profile_image',
                                        },
                                    },
                                },
                            },
                            {
                                case: { $eq: ['$userModel', 'Provider'] },
                                then: {
                                    $let: {
                                        vars: {
                                            user: {
                                                $arrayElemAt: ['$provider', 0],
                                            },
                                        },
                                        in: {
                                            _id: '$$user._id',
                                            name: '$$user.name',
                                            email: '$$user.email',
                                            profile_image: '$$user.profile_image',
                                        },
                                    },
                                },
                            },
                        ],
                        default: null,
                    },
                },
            },
        },
    ];
    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: [
                    { contactReason: { $regex: searchTerm, $options: 'i' } },
                    { message: { $regex: searchTerm, $options: 'i' } },
                    {
                        'userDetails.name': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'userDetails.email': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                ],
            },
        });
    }
    pipeline.push({
        $project: {
            customer: 0,
            provider: 0,
        },
    });
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
        $facet: {
            result: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: 'total' }],
        },
    });
    const aggResult = yield support_model_1.Support.aggregate(pipeline);
    const result = ((_a = aggResult === null || aggResult === void 0 ? void 0 : aggResult[0]) === null || _a === void 0 ? void 0 : _a.result) || [];
    const total = ((_d = (_c = (_b = aggResult === null || aggResult === void 0 ? void 0 : aggResult[0]) === null || _b === void 0 ? void 0 : _b.totalCount) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.total) || 0;
    const totalPages = Math.ceil(total / limit);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages,
        },
        result,
    };
});
const updateStatus = (id, status) => __awaiter(void 0, void 0, void 0, function* () {
    const validStatuses = Object.values(support_enum_1.ENUM_SUPPORT_STATUS);
    if (!validStatuses.includes(status)) {
        throw new appError_1.default(400, `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`);
    }
    const support = yield support_model_1.Support.findByIdAndUpdate(id, {
        status,
    }, { new: true, runValidators: true });
    return support;
});
const getSingle = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const pipeline = [
        {
            $match: {
                _id: new mongoose_1.Types.ObjectId(id),
            },
        },
        {
            $lookup: {
                from: 'customers',
                localField: 'user',
                foreignField: '_id',
                as: 'customer',
            },
        },
        {
            $lookup: {
                from: 'providers',
                localField: 'user',
                foreignField: '_id',
                as: 'provider',
            },
        },
        {
            $addFields: {
                userDetails: {
                    $switch: {
                        branches: [
                            {
                                case: { $eq: ['$userModel', 'Customer'] },
                                then: {
                                    $let: {
                                        vars: {
                                            user: {
                                                $arrayElemAt: ['$customer', 0],
                                            },
                                        },
                                        in: {
                                            _id: '$$user._id',
                                            name: '$$user.name',
                                            email: '$$user.email',
                                            profile_image: '$$user.profile_image',
                                        },
                                    },
                                },
                            },
                            {
                                case: { $eq: ['$userModel', 'Provider'] },
                                then: {
                                    $let: {
                                        vars: {
                                            user: {
                                                $arrayElemAt: ['$provider', 0],
                                            },
                                        },
                                        in: {
                                            _id: '$$user._id',
                                            name: '$$user.name',
                                            email: '$$user.email',
                                            profile_image: '$$user.profile_image',
                                        },
                                    },
                                },
                            },
                        ],
                        default: null,
                    },
                },
            },
        },
        {
            $project: {
                customer: 0,
                provider: 0,
            },
        },
    ];
    const result = yield support_model_1.Support.aggregate(pipeline);
    return result[0] || null;
});
const SupportService = {
    createSupport,
    getAllSupport,
    updateStatus,
    getSingle,
};
exports.default = SupportService;
