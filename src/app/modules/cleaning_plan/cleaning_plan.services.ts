import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import chatServices from '../chat/chat.services';
import { Client } from '../client/client.model';
import { Location } from '../location/location.model';
import { Task } from '../task/task.model';
import { resyncTodayShiftRoomsIfDue } from '../shift/shift.services';
import { ICleaningPlan } from './cleaning_plan.interface';
import { CleaningPlan } from './cleaning_plan.model';

/**
 * Server-computed conservative upper bound: sum of duration_minutes across
 * every active task under the given rooms. Deliberately worst-case (assumes
 * every task could land on the same day) rather than a per-date-accurate
 * figure — used only as an informational estimate on the plan (see
 * max_estimated_duration); the real, authoritative duration for a specific
 * day lives on that day's materialized Shift.
 */
const computeMaxEstimatedDuration = async (
    roomIds: (Types.ObjectId | string)[]
): Promise<number> => {
    if (!roomIds.length) return 0;
    const tasks = await Task.find({
        room: { $in: roomIds },
        is_active: true,
    })
        .select('duration_minutes')
        .lean();
    return tasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
};

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

type CreateCleaningPlanPayload = Omit<
    ICleaningPlan,
    'createdAt' | 'updatedAt' | 'max_estimated_duration'
>;

const createCleaningPlanIntoDB = async (
    managerId: string,
    payload: CreateCleaningPlanPayload
) => {
    await ensureClientExists(payload.client.toString());
    await ensureLocationExists(payload.location.toString());

    const rooms = payload.rooms ?? [];
    const max_estimated_duration = await computeMaxEstimatedDuration(rooms);

    const result = await CleaningPlan.create({
        ...payload,
        max_estimated_duration,
        manager: managerId,
        last_updated_by: managerId,
    });

    await chatServices.createChatGroupForPlan(result);

    emitAppEvent('cleaning_plan.created', {
        planId: result._id.toString(),
        title: result.title,
        clientId: result.client.toString(),
        managerId,
    });

    return result;
};

// ─── Update ────────────────────────────────────────────────────────────────────

type UpdateCleaningPlanPayload = Partial<ICleaningPlan>;

const updateCleaningPlanIntoDB = async (
    managerId: string,
    id: string,
    payload: UpdateCleaningPlanPayload
) => {
    const plan = await CleaningPlan.findById(id);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    const { rooms, ...rest } = payload;

    const update: Record<string, unknown> = { ...rest, last_updated_by: managerId };

    if (rooms !== undefined) {
        update.rooms = rooms;
        update.max_estimated_duration = await computeMaxEstimatedDuration(rooms);
    }

    const result = await CleaningPlan.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
    });

    // A room added/removed on the plan needs today's already-materialized
    // shift (if any) resynced — otherwise it keeps showing whatever
    // rooms/tasks existed at staffing time until someone re-visits it.
    if (result && rooms !== undefined) {
        await resyncTodayShiftRoomsIfDue(result._id, result.rooms);
    }

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

    await chatServices.deactivateChatGroupForPlan(id);

    emitAppEvent('cleaning_plan.deleted', {
        planId: id,
        title: plan.title,
        clientId: plan.client.toString(),
    });

    return result;
};

// ─── Get All ───────────────────────────────────────────────────────────────────

const getMyCleaningPlansFromDB = async (
    clientId: string,
    query: Record<string, unknown>
) => {
    const allowedQuery: Record<string, unknown> = {};
    for (const key of ['page', 'limit', 'searchTerm', 'sort', 'location']) {
        if (query[key] !== undefined) {
            if (typeof query[key] !== 'string') {
                throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${key}`);
            }
            allowedQuery[key] = query[key];
        }
    }
    for (const key of ['page', 'limit']) {
        if (allowedQuery[key] !== undefined) {
            const value = Number(allowedQuery[key]);
            if (!Number.isSafeInteger(value) || value < 1) {
                throw new AppError(httpStatus.BAD_REQUEST, `${key} must be a positive integer`);
            }
        }
    }
    if (allowedQuery.location && !Types.ObjectId.isValid(allowedQuery.location as string)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid location ID');
    }
    return getAllCleaningPlansFromDB({
        ...allowedQuery,
        client: clientId,
        is_active: true,
    });
};

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

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
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
                    $lookup: {
                        from: 'tasks',
                        let: { planRooms: { $ifNull: ['$rooms', []] } },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $in: ['$room', '$$planRooms'] },
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
                    {
                        $lookup: {
                            from: 'tasks',
                            localField: '_id',
                            foreignField: 'room',
                            as: 'tasks',
                            pipeline: [{ $match: { is_active: true } }],
                        },
                    },
                    {
                        $addFields: {
                            total_task: { $size: { $ifNull: ['$tasks', []] } },
                            total_duration: { $sum: '$tasks.duration_minutes' },
                        },
                    },
                ],
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
                total_duration: { $sum: '$rooms.total_duration' },
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
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    return plan;
};

// ───────────────────────────────────────────────────────────────────────────────

const cleaningPlanServices = {
    getMyCleaningPlansFromDB,
    createCleaningPlanIntoDB,
    updateCleaningPlanIntoDB,
    deleteCleaningPlanFromDB,
    getAllCleaningPlansFromDB,
    getSingleCleaningPlanFromDB,
};

export default cleaningPlanServices;
