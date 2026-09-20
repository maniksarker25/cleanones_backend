import httpStatus from 'http-status';
import mongoose, { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import chatServices from '../chat/chat.services';
import { Client } from '../client/client.model';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import {
    cancelUpcomingShiftsAcrossPlans,
    resyncTodayShiftLocationIfDue,
} from '../shift/shift.services';
import { Worker } from '../worker/worker.model';
import { TLocation } from './location.interface';
import { Location } from './location.model';

const ensureClientExists = async (clientId: string) => {
    const client = await Client.findOne({
        _id: clientId,
        isDeleted: false,
    });

    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }

    return client;
};

const ensureWorkerExists = async (workerId: string) => {
    const worker = await Worker.findOne({ _id: workerId, isDeleted: false });

    if (!worker) {
        throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    }

    return worker;
};

const createLocationIntoDB = async (
    managerId: string,
    payload: TLocation
) => {
    await ensureClientExists(payload.client.toString());

    const result = await Location.create({
        ...payload,
        last_updated_by: managerId,
    });
    return result;
};

const updateLocationIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<TLocation>
) => {
    const location = await Location.findById(id);
    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    const result = await Location.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );

    const affectedPlans = await CleaningPlan.find({
        location: id,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('_id')
        .lean();
    await Promise.all(
        affectedPlans.map((plan) => resyncTodayShiftLocationIfDue(plan._id))
    );

    return result;
};

const deleteLocationFromDB = async (managerId: string, id: string) => {
    const location = await Location.findById(id);
    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    const session = await mongoose.startSession();
    let result;
    let planCount: number;
    let workerIds: string[];
    try {
        const output = await session.withTransaction(async () => {
            const updatedLocation = await Location.findByIdAndUpdate(
                id,
                { is_active: false, last_updated_by: managerId },
                { new: true, session }
            );

      
            const affectedPlans = await CleaningPlan.find({
                location: id,
                is_active: true,
            })
                .select('_id')
                .session(session)
                .lean();
            const planIds = affectedPlans.map((p) => p._id);

            if (planIds.length) {
                await CleaningPlan.updateMany(
                    { _id: { $in: planIds } },
                    { is_active: false, last_updated_by: managerId },
                    { session }
                );
                await chatServices.deactivateChatGroupsForPlans(planIds, session);
            }

            const cancelledWorkerIds = await cancelUpcomingShiftsAcrossPlans(
                planIds,
                managerId,
                session
            );

            return {
                updatedLocation,
                planCount: planIds.length,
                cancelledWorkerIds,
            };
        });
        result = output.updatedLocation;
        planCount = output.planCount;
        workerIds = output.cancelledWorkerIds;
    } finally {
        await session.endSession();
    }

    emitAppEvent('location.deactivated', {
        locationId: id,
        locationName: location.name,
        clientId: location.client.toString(),
        planCount,
        workerIds,
    });

    return result;
};

const getAllLocationsFromDB = async (query: Record<string, unknown>) => {
    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: any = {};
    Object.keys(query).forEach((key) => {
        if (
            !['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)
        ) {
            filters[key] =
                key === 'client'
                    ? new Types.ObjectId(query[key] as string)
                    : query[key];
        }
    });

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

    const pipeline: PipelineStage[] = [
        { $match: { is_active: true, ...filters } },
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

    const [aggResult] = await Location.aggregate(pipeline);

    const total = aggResult?.metadata?.[0]?.total || 0;
    const result = aggResult?.data || [];

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

const getClientLocationsFromDB = async (
    clientId: string,
    query: Record<string, unknown>
) => {
    await ensureClientExists(clientId);

    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: any = {};
    Object.keys(query).forEach((key) => {
        if (
            !['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)
        ) {
            filters[key] = query[key];
        }
    });

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

    const pipeline: PipelineStage[] = [
        {
            $match: {
                is_active: true,
                client: new Types.ObjectId(clientId),
                ...filters,
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

    const [aggResult] = await Location.aggregate(pipeline);

    const total = aggResult?.metadata?.[0]?.total || 0;
    const result = aggResult?.data || [];

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

const getWorkerLocationsFromDB = async (
    workerId: string,
    query: Record<string, unknown>
) => {
    await ensureWorkerExists(workerId);

    const locationIds = await CleaningPlan.find({
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    }).distinct('location');

    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: any = {};
    Object.keys(query).forEach((key) => {
        if (
            !['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)
        ) {
            filters[key] =
                key === 'client'
                    ? new Types.ObjectId(query[key] as string)
                    : query[key];
        }
    });

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

    const pipeline: PipelineStage[] = [
        {
            $match: {
                _id: { $in: locationIds },
                is_active: true,
                ...filters,
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

    const [aggResult] = await Location.aggregate(pipeline);

    const total = aggResult?.metadata?.[0]?.total || 0;
    const result = aggResult?.data || [];

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

const getMyLocationsFromDB = async (
    clientId: string,
    query: Record<string, unknown>
) => {
    await ensureClientExists(clientId);

    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

    const pipeline: PipelineStage[] = [
        {
            $match: {
                is_active: true,
                client: new Types.ObjectId(clientId),
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

    const [aggResult] = await Location.aggregate(pipeline);

    const total = aggResult?.metadata?.[0]?.total || 0;
    const result = aggResult?.data || [];

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

const getSingleLocationFromDB = async (id: string) => {
    const [location] = await Location.aggregate([
        { $match: { _id: new Types.ObjectId(id) } },
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
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    return location;
};

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

export default locationServices;
