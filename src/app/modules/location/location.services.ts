import httpStatus from 'http-status';
import mongoose, { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { managerScope, toManagerObjectId } from '../../utilities/managerScope';
import { USER_ROLE } from '../user/user.constant';
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

// `managerId` is omitted only for the client's own endpoints, where the client
// id comes from the session rather than the request.
const ensureClientExists = async (clientId: string, managerId?: string) => {
    const client = await Client.findOne({
        _id: clientId,
        isDeleted: false,
        ...(managerId && managerScope(managerId)),
    });

    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }

    return client;
};

const ensureWorkerExists = async (managerId: string, workerId: string) => {
    const worker = await Worker.findOne({
        _id: workerId,
        isDeleted: false,
        ...managerScope(managerId),
    });

    if (!worker) {
        throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    }

    return worker;
};

const createLocationIntoDB = async (
    managerId: string,
    payload: TLocation
) => {
    const client = await ensureClientExists(
        payload.client.toString(),
        managerId
    );

    const result = await Location.create({
        ...payload,
        manager: client.manager,
        last_updated_by: managerId,
    });
    return result;
};

const updateLocationIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<TLocation>
) => {
    // Ownership and tenancy are fixed at creation; never reassignable here.
    delete (payload as { manager?: unknown }).manager;
    delete (payload as { client?: unknown }).client;

    const location = await Location.findOne({
        _id: id,
        ...managerScope(managerId),
    });
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
export const cascadeCancelPlansForLocations = async (
    locationIds: (Types.ObjectId | string)[],
    managerId: string,
    session: mongoose.ClientSession
): Promise<{ planCount: number; cancelledWorkerIds: string[] }> => {
    if (!locationIds.length) return { planCount: 0, cancelledWorkerIds: [] };

    const affectedPlans = await CleaningPlan.find({
        location: { $in: locationIds },
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

    return { planCount: planIds.length, cancelledWorkerIds };
};

const deleteLocationFromDB = async (managerId: string, id: string) => {
    const location = await Location.findOne({
        _id: id,
        ...managerScope(managerId),
    });
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

            const { planCount, cancelledWorkerIds } =
                await cascadeCancelPlansForLocations([id], managerId, session);

            return {
                updatedLocation,
                planCount,
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

const getAllLocationsFromDB = async (
    managerId: string,
    query: Record<string, unknown>
) => {
    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: Record<string, unknown> = {};
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
        // Tenant scope last so a ?manager= in the query can't override it.
        {
            $match: {
                is_active: true,
                ...filters,
                manager: toManagerObjectId(managerId),
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

const getClientLocationsFromDB = async (
    managerId: string,
    clientId: string,
    query: Record<string, unknown>
) => {
    await ensureClientExists(clientId, managerId);

    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: Record<string, unknown> = {};
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
                ...filters,
                client: new Types.ObjectId(clientId),
                manager: toManagerObjectId(managerId),
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
    managerId: string,
    workerId: string,
    query: Record<string, unknown>
) => {
    await ensureWorkerExists(managerId, workerId);

    const locationIds = await CleaningPlan.find({
        ...managerScope(managerId),
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    }).distinct('location');

    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: Record<string, unknown> = {};
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
                is_active: true,
                ...filters,
                _id: { $in: locationIds },
                manager: toManagerObjectId(managerId),
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

// A manager may read only their own locations and a client only theirs; both
// mismatches come back as "not found".
const getSingleLocationFromDB = async (
    viewer: { role: string; profileId: string },
    id: string
) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid location ID');
    }
    const ownerMatch =
        viewer.role === USER_ROLE.manager
            ? { manager: toManagerObjectId(viewer.profileId) }
            : { client: new Types.ObjectId(viewer.profileId) };
    const [location] = await Location.aggregate([
        { $match: { _id: new Types.ObjectId(id), ...ownerMatch } },
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
