import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { Client } from '../client/client.model';
import { Location } from '../location/location.model';
import { ICleaningPlan } from './cleaning_plan.interface';
import { CleaningPlan } from './cleaning_plan.model';

const ensureClientExists = async (clientId: string) => {
    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    return client;
};

const ensureLocationExists = async (locationId: string) => {
    const location = await Location.findOne({
        _id: locationId,
        is_active: true,
    });
    if (!location)
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    return location;
};

// ─── Create ────────────────────────────────────────────────────────────────────

const createCleaningPlanIntoDB = async (
    managerId: string,
    payload: Omit<ICleaningPlan, 'createdAt' | 'updatedAt'>
) => {
    await ensureClientExists(payload.client.toString());
    await ensureLocationExists(payload.location.toString());

    const result = await CleaningPlan.create({
        ...payload,
        manager: managerId,
        last_updated_by: managerId,
    });
    return result;
};

// ─── Update ────────────────────────────────────────────────────────────────────

const updateCleaningPlanIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<ICleaningPlan>
) => {
    const plan = await CleaningPlan.findById(id);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    const result = await CleaningPlan.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );
    return result;
};

// ─── Delete (soft) ─────────────────────────────────────────────────────────────

const deleteCleaningPlanFromDB = async (managerId: string, id: string) => {
    const plan = await CleaningPlan.findById(id);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    const result = await CleaningPlan.findByIdAndUpdate(
        id,
        { is_active: false, last_updated_by: managerId },
        { new: true }
    );
    return result;
};

// ─── Get All ───────────────────────────────────────────────────────────────────

const getAllCleaningPlansFromDB = async (
    query: Record<string, unknown>
) => {
    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: Record<string, unknown> = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)) {
            filters[key] =
                key === 'client' || key === 'location'
                    ? new Types.ObjectId(query[key] as string)
                    : query[key];
        }
    });

    const sortOrder = sort?.startsWith('-') ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

    const pipeline: PipelineStage[] = [
        { $match: { is_active: true, ...filters } },
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
                    $addFields: {
                        total_room: { $size: { $ifNull: ['$rooms', []] } },
                        total_assigned_worker: {
                            $size: { $ifNull: ['$assigned_workers', []] },
                        },
                        total_additional_task: {
                            $size: { $ifNull: ['$additional_tasks', []] },
                        },
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
                        assigned_workers: 0,
                        additional_tasks: 0,
                    },
                },
            ],
        },
    });

    const [aggResult] = await CleaningPlan.aggregate(pipeline);

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

// ─── Get Single ────────────────────────────────────────────────────────────────

const getSingleCleaningPlanFromDB = async (id: string) => {
    const [plan] = await CleaningPlan.aggregate([
        { $match: { _id: new Types.ObjectId(id) } },
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
                localField: 'rooms',
                foreignField: '_id',
                as: 'rooms',
                pipeline: [
                    { $project: { location: 0, last_updated_by: 0 } },
                ],
            },
        },
        {
            $lookup: {
                from: 'workers',
                localField: 'assigned_workers.worker',
                foreignField: '_id',
                as: '_workerDocs',
            },
        },
        {
            $addFields: {
                assigned_workers: {
                    $map: {
                        input: '$assigned_workers',
                        as: 'aw',
                        in: {
                            role: '$$aw.role',
                            worker: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: '$_workerDocs',
                                            as: 'w',
                                            cond: {
                                                $eq: [
                                                    '$$w._id',
                                                    '$$aw.worker',
                                                ],
                                            },
                                        },
                                    },
                                    0,
                                ],
                            },
                        },
                    },
                },
            },
        },
        {
            $lookup: {
                from: 'additional_tasks',
                localField: 'additional_tasks',
                foreignField: '_id',
                as: 'additional_tasks',
            },
        },
        {
            $addFields: {
                total_rooms: { $size: { $ifNull: ['$rooms', []] } },
                total_assigned_workers: {
                    $size: { $ifNull: ['$assigned_workers', []] },
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
                            pipeline: [{ $project: { password: 0 } }],
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
                            pipeline: [{ $project: { password: 0 } }],
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
        { $project: { _workerDocs: 0 } },
    ]);

    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    return plan;
};

// ───────────────────────────────────────────────────────────────────────────────

const cleaningPlanServices = {
    createCleaningPlanIntoDB,
    updateCleaningPlanIntoDB,
    deleteCleaningPlanFromDB,
    getAllCleaningPlansFromDB,
    getSingleCleaningPlanFromDB,
};

export default cleaningPlanServices;
