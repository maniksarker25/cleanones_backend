import httpStatus from 'http-status';
import mongoose, { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import chatServices from '../chat/chat.services';
import { Client } from '../client/client.model';
import { Location } from '../location/location.model';
import { Task } from '../task/task.model';
import {
    cancelUpcomingShiftsAcrossPlans,
    resyncTodayShiftRoomsIfDue,
} from '../shift/shift.services';
import { ICleaningPlan } from './cleaning_plan.interface';
import { CleaningPlan } from './cleaning_plan.model';

/** Worst-case estimate (assumes every task lands the same day): sum of duration_minutes across the plan's tasks. */
const computeMaxEstimatedDuration = async (
    taskIds: (Types.ObjectId | string)[]
): Promise<number> => {
    if (!taskIds.length) return 0;
    const tasks = await Task.find({
        _id: { $in: taskIds },
        is_active: true,
    })
        .select('duration_minutes')
        .lean();
    return tasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
};

/** Enforces that every selected task belongs to one of the plan's selected rooms; also catches stale task ids. */
const validateTasksBelongToRooms = async (
    taskIds: (Types.ObjectId | string)[],
    roomIds: (Types.ObjectId | string)[]
): Promise<void> => {
    if (!taskIds.length) return;

    const uniqueTaskIds = [...new Set(taskIds.map(String))];
    const roomIdSet = new Set(roomIds.map(String));

    const tasks = await Task.find({ _id: { $in: uniqueTaskIds } })
        .select('room')
        .lean();

    if (tasks.length !== uniqueTaskIds.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'One or more selected tasks do not exist'
        );
    }
    const invalid = tasks.some((t) => !roomIdSet.has(t.room.toString()));
    if (invalid) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "One or more selected tasks do not belong to this plan's selected rooms"
        );
    }
};

/** Drops any selected task whose room fell out of the plan's (just-updated) room list. */
const pruneTasksForRemovedRooms = async (
    taskIds: (Types.ObjectId | string)[],
    roomIds: (Types.ObjectId | string)[]
): Promise<Types.ObjectId[]> => {
    if (!taskIds.length) return [];

    const roomIdSet = new Set(roomIds.map(String));
    const tasks = await Task.find({ _id: { $in: taskIds } })
        .select('room')
        .lean();
    const keepTaskIdSet = new Set(
        tasks
            .filter((t) => roomIdSet.has(t.room.toString()))
            .map((t) => t._id.toString())
    );

    return taskIds
        .map(String)
        .filter((id) => keepTaskIdSet.has(id))
        .map((id) => new Types.ObjectId(id));
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
    const tasks = payload.tasks ?? [];
    await validateTasksBelongToRooms(tasks, rooms);
    const max_estimated_duration = await computeMaxEstimatedDuration(tasks);

    const result = await CleaningPlan.create({
        ...payload,
        rooms,
        tasks,
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

    const { rooms, tasks, ...rest } = payload;

    const update: Record<string, unknown> = { ...rest, last_updated_by: managerId };

    const effectiveRooms = rooms !== undefined ? rooms : plan.rooms;
    let effectiveTasks = tasks !== undefined ? tasks : plan.tasks;

    if (tasks !== undefined) {
        // Must belong to whichever room list is in effect after this same edit.
        await validateTasksBelongToRooms(tasks, effectiveRooms);
    } else if (rooms !== undefined) {
        // Rooms changed but tasks weren't touched — drop any task whose room just fell out.
        effectiveTasks = await pruneTasksForRemovedRooms(plan.tasks, rooms);
    }

    if (rooms !== undefined) {
        update.rooms = rooms;
    }
    if (rooms !== undefined || tasks !== undefined) {
        update.tasks = effectiveTasks;
        update.max_estimated_duration = await computeMaxEstimatedDuration(effectiveTasks);
    }

    const result = await CleaningPlan.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
    });

    // Keeps today's already-materialized shift (if any) in sync with this change.
    if (result && (rooms !== undefined || tasks !== undefined)) {
        await resyncTodayShiftRoomsIfDue(result._id, result.rooms, result.tasks);
    }

    return result;
};

// ─── Delete (soft) ─────────────────────────────────────────────────────────────

const deleteCleaningPlanFromDB = async (managerId: string, id: string) => {
    const plan = await CleaningPlan.findById(id);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    // Plan flip + chat group + shift cancellation land atomically; events fire only after commit.
    const session = await mongoose.startSession();
    let result;
    let workerIds: string[];
    try {
        const output = await session.withTransaction(async () => {
            const updated = await CleaningPlan.findByIdAndUpdate(
                id,
                { is_active: false, last_updated_by: managerId },
                { new: true, session }
            );
            await chatServices.deactivateChatGroupForPlan(id, session);
            const cancelledWorkerIds = await cancelUpcomingShiftsAcrossPlans(
                [id],
                managerId,
                session
            );
            return { updated, cancelledWorkerIds };
        });
        result = output.updated;
        workerIds = output.cancelledWorkerIds;
    } finally {
        await session.endSession();
    }

    emitAppEvent('cleaning_plan.deleted', {
        planId: id,
        title: plan.title,
        clientId: plan.client.toString(),
    });
    if (workerIds.length) {
        emitAppEvent('cleaning_plan.shifts_cancelled', {
            planId: id,
            title: plan.title,
            workerIds,
        });
    }

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
                let: {
                    roomIds: { $ifNull: ['$rooms', []] },
                    planTaskIds: { $ifNull: ['$tasks', []] },
                },
                pipeline: [
                    { $match: { $expr: { $in: ['$_id', '$$roomIds'] } } },
                    { $project: { location: 0, last_updated_by: 0 } },
                    {
                        // Only this plan's own selected tasks under the room, not every active task.
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
                // Regular checklist duration only, excluding ad-hoc tasks.
                total_task_duration: { $sum: '$rooms.total_duration' },
                // Sum across every AdditionalTask regardless of status.
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
            // Grand total: checklist time + ad-hoc task time.
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
