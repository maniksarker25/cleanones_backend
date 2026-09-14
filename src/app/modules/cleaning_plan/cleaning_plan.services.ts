import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import chatServices from '../chat/chat.services';
import { Client } from '../client/client.model';
import { Location } from '../location/location.model';
import { Worker } from '../worker/worker.model';
import {
    getOrCreateShift,
    resyncTodayShiftRoomsIfDue,
    resyncTodayShiftWorkersIfDue,
} from '../shift/shift.services';
import {
    assertWorkersAssignable,
    computeMaxEstimatedDuration,
    listEligibleWorkersForPlan,
} from './cleaning_plan.availability.services';
import { IAssignedWorker, ICleaningPlan } from './cleaning_plan.interface';
import { CleaningPlan } from './cleaning_plan.model';

/**
 * Best-effort same-day materialization: if the plan (with its current rooms/
 * tasks/workers) actually occurs today, create today's Shift right away
 * instead of waiting for the midnight cron — so a plan created/assigned
 * today can be checked into today. getOrCreateShift is idempotent (unique
 * cleaning_plan+date index), so this is always safe to call. Errors (no
 * occurrence today, inactive plan, etc.) are expected in the common case and
 * must never fail the caller's create/update/assign request — the nightly
 * cron remains the fallback that eventually materializes it regardless.
 */
const materializeTodayShiftIfDue = async (planId: Types.ObjectId | string) => {
    try {
        await getOrCreateShift(planId, new Date());
    } catch (error) {
        console.error(
            `Same-day shift materialization skipped for plan ${planId}:`,
            error
        );
    }
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
> & { force?: boolean };

const createCleaningPlanIntoDB = async (
    managerId: string,
    payload: CreateCleaningPlanPayload
) => {
    await ensureClientExists(payload.client.toString());
    await ensureLocationExists(payload.location.toString());

    const { force, assigned_workers, ...rest } = payload;
    const rooms = rest.rooms ?? [];
    const max_estimated_duration = await computeMaxEstimatedDuration(rooms);
    // validateRequest doesn't apply Zod's coerced output back onto req.body,
    // so date_time/end_date can still be raw strings here — normalize explicitly
    // before any Date arithmetic in the availability engine.
    const dateTime = new Date(rest.date_time);
    const endDate = rest.end_date ? new Date(rest.end_date) : null;

    let finalAssignedWorkers: IAssignedWorker[] = [];
    if (assigned_workers?.length) {
        const tempPlanId = new Types.ObjectId();
        const conflicts = await assertWorkersAssignable(
            {
                _id: tempPlanId,
                date_time: dateTime,
                end_date: endDate,
                rooms,
            },
            assigned_workers.map((aw) => aw.worker),
            !!force
        );
        finalAssignedWorkers = assigned_workers.map((aw) => ({
            ...aw,
            assigned_with_conflict: conflicts.has(aw.worker.toString()),
        }));
    }

    const result = await CleaningPlan.create({
        ...rest,
        date_time: dateTime,
        end_date: endDate,
        assigned_workers: finalAssignedWorkers,
        max_estimated_duration,
        manager: managerId,
        last_updated_by: managerId,
    });

    await materializeTodayShiftIfDue(result._id);
    await chatServices.createChatGroupForPlan(result);

    emitAppEvent('cleaning_plan.created', {
        planId: result._id.toString(),
        title: result.title,
        clientId: result.client.toString(),
        managerId,
        assignedWorkerIds: result.assigned_workers.map((aw) =>
            aw.worker.toString()
        ),
    });

    return result;
};

// ─── Update ────────────────────────────────────────────────────────────────────

type UpdateCleaningPlanPayload = Partial<ICleaningPlan> & { force?: boolean };

const updateCleaningPlanIntoDB = async (
    managerId: string,
    id: string,
    payload: UpdateCleaningPlanPayload
) => {
    const plan = await CleaningPlan.findById(id);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    const { force, assigned_workers, rooms, date_time, end_date, ...rest } =
        payload;
    const effectiveRooms = rooms ?? plan.rooms;
    // Normalize possible raw strings (validateRequest doesn't apply Zod's
    // coerced output back onto req.body) before any Date arithmetic.
    const effectiveDateTime = date_time ? new Date(date_time) : plan.date_time;
    const effectiveEndDate =
        end_date !== undefined
            ? end_date
                ? new Date(end_date)
                : null
            : plan.end_date ?? null;

    const update: Record<string, unknown> = { ...rest, last_updated_by: managerId };
    if (date_time !== undefined) update.date_time = effectiveDateTime;
    if (end_date !== undefined) update.end_date = effectiveEndDate;

    if (rooms !== undefined) {
        update.rooms = rooms;
        update.max_estimated_duration = await computeMaxEstimatedDuration(
            effectiveRooms
        );
    }

    if (assigned_workers?.length) {
        const conflicts = await assertWorkersAssignable(
            {
                _id: plan._id,
                date_time: effectiveDateTime,
                end_date: effectiveEndDate,
                rooms: effectiveRooms,
            },
            assigned_workers.map((aw) => aw.worker),
            !!force
        );
        update.assigned_workers = assigned_workers.map((aw) => ({
            ...aw,
            assigned_with_conflict: conflicts.has(aw.worker.toString()),
        }));
    }

    const result = await CleaningPlan.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
    });

    // Only worth re-checking today's occurrence when something that affects
    // it actually changed (rooms/tasks, workers, or the schedule itself).
    if (
        result &&
        (rooms !== undefined || assigned_workers?.length || date_time !== undefined)
    ) {
        await materializeTodayShiftIfDue(result._id);
    }

    // getOrCreateShift/materializeTodayShiftIfDue above is a no-op once
    // today's shift already exists, so a room added/removed on the plan
    // after that point needs its own sync — otherwise today's already-
    // materialized shift keeps showing whatever rooms/tasks existed at
    // materialization time until the next midnight cron.
    if (result && rooms !== undefined) {
        await resyncTodayShiftRoomsIfDue(result._id, result.rooms);
    }

    if (result && assigned_workers?.length) {
        await chatServices.syncChatGroupWorkers(
            result._id,
            result.assigned_workers.map((aw) => aw.worker)
        );
        await resyncTodayShiftWorkersIfDue(result._id, result.assigned_workers);
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
        workerIds: plan.assigned_workers.map((aw) => aw.worker.toString()),
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
                        total_assigned_worker: {
                            $size: { $ifNull: ['$assigned_workers', []] },
                        },
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
                        assigned_workers: 0,
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
                from: Worker.collection.name,
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
        { $project: { _workerDocs: 0 } },
    ]);

    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    return plan;
};

// ─── Eligible workers (preview) ─────────────────────────────────────────────────

const getEligibleWorkersForPlan = async (id: string) => {
    return listEligibleWorkersForPlan(id);
};

// ─── Assign workers (enforce) ───────────────────────────────────────────────────

const assignWorkersToPlan = async (
    managerId: string,
    id: string,
    assigned_workers: IAssignedWorker[],
    force: boolean
) => {
    const plan = await CleaningPlan.findById(id);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    const conflicts = await assertWorkersAssignable(
        {
            _id: plan._id,
            date_time: plan.date_time,
            end_date: plan.end_date ?? null,
            rooms: plan.rooms,
        },
        assigned_workers.map((aw) => aw.worker),
        force
    );

    const result = await CleaningPlan.findByIdAndUpdate(
        id,
        {
            assigned_workers: assigned_workers.map((aw) => ({
                ...aw,
                assigned_with_conflict: conflicts.has(aw.worker.toString()),
            })),
            last_updated_by: managerId,
        },
        { new: true, runValidators: true }
    );

    if (result) {
        await materializeTodayShiftIfDue(result._id);
        await chatServices.syncChatGroupWorkers(
            result._id,
            result.assigned_workers.map((aw) => aw.worker)
        );
        await resyncTodayShiftWorkersIfDue(result._id, result.assigned_workers);
    }

    return result;
};

// ───────────────────────────────────────────────────────────────────────────────

const cleaningPlanServices = {
    getMyCleaningPlansFromDB,
    createCleaningPlanIntoDB,
    updateCleaningPlanIntoDB,
    deleteCleaningPlanFromDB,
    getAllCleaningPlansFromDB,
    getSingleCleaningPlanFromDB,
    getEligibleWorkersForPlan,
    assignWorkersToPlan,
};

export default cleaningPlanServices;
