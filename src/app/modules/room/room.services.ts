import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { managerScope, toManagerObjectId } from '../../utilities/managerScope';
import { Location } from '../location/location.model';
import { TRoom } from './room.interface';
import { Room } from './room.model';

// `managerId` is omitted only on the client's own path, which has already
// verified the location belongs to the calling client.
const ensureLocationExists = async (locationId: string, managerId?: string) => {
    const location = await Location.findOne({
        _id: locationId,
        is_active: true,
        ...(managerId && managerScope(managerId)),
    });

    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    return location;
};

const createRoomIntoDB = async (managerId: string, payload: TRoom) => {
    const location = await ensureLocationExists(
        payload.location.toString(),
        managerId
    );

    const result = await Room.create({
        ...payload,
        manager: location.manager,
        last_updated_by: managerId,
    });
    return result;
};

const updateRoomIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<TRoom>
) => {
    delete (payload as { manager?: unknown }).manager;
    delete (payload as { location?: unknown }).location;

    const room = await Room.findOne({ _id: id, ...managerScope(managerId) });
    if (!room) {
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    const result = await Room.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );

    return result;
};

const deleteRoomFromDB = async (managerId: string, id: string) => {
    const room = await Room.findOne({ _id: id, ...managerScope(managerId) });
    if (!room) {
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    const result = await Room.findByIdAndUpdate(
        id,
        { is_active: false, last_updated_by: managerId },
        { new: true }
    );

    return result;
};

const getAllRoomsByLocationFromDB = async (
    managerId: string | null,
    locationId: string,
    query: Record<string, unknown>
) => {
    await ensureLocationExists(locationId, managerId ?? undefined);

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
                location: new Types.ObjectId(locationId),
                ...(managerId && { manager: toManagerObjectId(managerId) }),
            },
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

    const [aggResult] = await Room.aggregate(pipeline);

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

const getAllRoomsFromDB = async (
    managerId: string,
    query: Record<string, unknown>
) => {
    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const matchConditions: Record<string, unknown>[] = [
        { is_active: true },
        { manager: toManagerObjectId(managerId) },
    ];

    Object.keys(query).forEach((key) => {
        if (
            [
                'searchTerm',
                'page',
                'limit',
                'sort',
                'fields',
                'location',
                'client',
                'manager',
            ].includes(key)
        ) {
            return;
        }
        matchConditions.push({ [key]: query[key] });
    });

    if (query.location) {
        matchConditions.push({
            location: new Types.ObjectId(query.location as string),
        });
    }

    if (query.client) {
        const clientLocationIds = await Location.find({
            client: new Types.ObjectId(query.client as string),
            ...managerScope(managerId),
        }).distinct('_id');
        matchConditions.push({ location: { $in: clientLocationIds } });
    }

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

    const pipeline: PipelineStage[] = [{ $match: { $and: matchConditions } }];

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

    const [aggResult] = await Room.aggregate(pipeline);

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

const getMyRoomsFromDB = async (
    clientId: string,
    locationId: string,
    query: Record<string, unknown>
) => {
    const location = await Location.findOne({
        _id: locationId,
        client: clientId,
        is_active: true,
    });

    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    return getAllRoomsByLocationFromDB(null, locationId, query);
};

const getSingleRoomFromDB = async (managerId: string, id: string) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid room ID');
    }
    const [room] = await Room.aggregate([
        {
            $match: {
                _id: new Types.ObjectId(id),
                manager: toManagerObjectId(managerId),
            },
        },
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
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    return room;
};

const roomServices = {
    createRoomIntoDB,
    updateRoomIntoDB,
    deleteRoomFromDB,
    getAllRoomsFromDB,
    getAllRoomsByLocationFromDB,
    getMyRoomsFromDB,
    getSingleRoomFromDB,
};

export default roomServices;
