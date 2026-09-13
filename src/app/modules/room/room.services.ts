import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { Location } from '../location/location.model';
import { TRoom } from './room.interface';
import { Room } from './room.model';

const ensureLocationExists = async (locationId: string) => {
    const location = await Location.findOne({
        _id: locationId,
        is_active: true,
    });

    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    return location;
};

const createRoomIntoDB = async (managerId: string, payload: TRoom) => {
    await ensureLocationExists(payload.location.toString());

    const result = await Room.create({
        ...payload,
        last_updated_by: managerId,
    });
    return result;
};

const updateRoomIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<TRoom>
) => {
    const room = await Room.findById(id);
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
    const room = await Room.findById(id);
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
    locationId: string,
    query: Record<string, unknown>
) => {
    await ensureLocationExists(locationId);

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

    const sortOrder = sort?.startsWith('-') ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'created_at';

    const pipeline: PipelineStage[] = [
        {
            $match: {
                is_active: true,
                location: new Types.ObjectId(locationId),
                ...filters,
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

const getAllRoomsFromDB = async (query: Record<string, unknown>) => {
    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const matchConditions: Record<string, unknown>[] = [{ is_active: true }];

    Object.keys(query).forEach((key) => {
        if (
            ['searchTerm', 'page', 'limit', 'sort', 'fields', 'location', 'client'].includes(
                key
            )
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
        }).distinct('_id');
        matchConditions.push({ location: { $in: clientLocationIds } });
    }

    const sortOrder = sort?.startsWith('-') ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'created_at';

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

    return getAllRoomsByLocationFromDB(locationId, query);
};

const getSingleRoomFromDB = async (id: string) => {
    const [room] = await Room.aggregate([
        { $match: { _id: new Types.ObjectId(id) } },
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
