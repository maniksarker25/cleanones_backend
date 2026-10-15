import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { managerScope } from '../../utilities/managerScope';
import { Room } from '../room/room.model';
import shiftServices from '../shift/shift.services';
import { TTask } from './task.interface';
import { Task } from './task.model';

const resolveRoomHierarchy = async (managerId: string, roomId: string) => {
    const room = await Room.findOne({
        _id: roomId,
        is_active: true,
        ...managerScope(managerId),
    });

    if (!room) {
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    const location = await room.populate<{
        location: { _id: string; client: string; is_active: boolean };
    }>('location');

    const populatedLocation = location.location as unknown as {
        _id: string;
        client: string;
        is_active: boolean;
    };

    if (!populatedLocation || !populatedLocation.is_active) {
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    }

    return {
        manager: room.manager,
        room: room._id,
        location: populatedLocation._id,
        client: populatedLocation.client,
    };
};

const createTaskIntoDB = async (
    managerId: string,
    payload: Omit<TTask, 'client' | 'location' | 'manager'>
) => {
    const hierarchy = await resolveRoomHierarchy(
        managerId,
        payload.room.toString()
    );

    const result = await Task.create({
        ...payload,
        manager: hierarchy.manager,
        client: hierarchy.client,
        location: hierarchy.location,
        room: hierarchy.room,
        last_updated_by: managerId,
    });

    await shiftServices.resyncTodayShiftTasksForRoomsIfDue([hierarchy.room]);

    return result;
};

// Whether this update actually touches a field that occursOnDate cares
// about — a plain rename/duration/photo edit never changes WHICH dates the
// task is due on, so it's not worth the extra plan/shift scan below.
const changesRecurrence = (
    task: TTask,
    payload: Omit<Partial<TTask>, 'client' | 'location' | 'room' | 'manager'>
): boolean => {
    if (payload.is_active === false && task.is_active !== false) return true;
    if (
        payload.frequency_type !== undefined &&
        payload.frequency_type !== task.frequency_type
    )
        return true;
    if (
        payload.days_of_week !== undefined &&
        JSON.stringify(payload.days_of_week) !==
            JSON.stringify(task.days_of_week ?? [])
    )
        return true;
    if (
        payload.days_of_month !== undefined &&
        JSON.stringify(payload.days_of_month) !==
            JSON.stringify(task.days_of_month ?? [])
    )
        return true;
    return false;
};

const updateTaskIntoDB = async (
    managerId: string,
    id: string,
    payload: Omit<Partial<TTask>, 'client' | 'location' | 'room' | 'manager'>,
    force = false
) => {
    delete (payload as { manager?: unknown }).manager;

    const task = await Task.findOne({ _id: id, ...managerScope(managerId) });
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    const recurrenceChanged = changesRecurrence(task, payload);

    if (recurrenceChanged) {
        const willStayActive = payload.is_active !== false;
        // Reconciles/blocks BEFORE the Task write itself — a 409 here (no
        // force) must leave the task untouched, not half-applied.
        await shiftServices.reconcileFutureShiftsForTaskChange(
            [task.room],
            task._id,
            willStayActive
                ? {
                      frequency_type: payload.frequency_type ?? task.frequency_type,
                      days_of_week: payload.days_of_week ?? task.days_of_week,
                      days_of_month: payload.days_of_month ?? task.days_of_month,
                      createdAt: task.createdAt,
                  }
                : null,
            managerId,
            force
        );
    }

    const result = await Task.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );

    await shiftServices.resyncTodayShiftTasksForRoomsIfDue([task.room]);
    if (recurrenceChanged) {
        await shiftServices.resyncFutureShiftTasksForRoomsIfDue([task.room]);
    }

    return result;
};

const deleteTaskFromDB = async (managerId: string, id: string, force = false) => {
    const task = await Task.findOne({ _id: id, ...managerScope(managerId) });
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    // A deleted/deactivated task drops out of the plan's recurrence pattern
    // exactly like an edit that no longer covers a date — same reconcile
    // gate, same 409-unless-force behavior, run before the write.
    await shiftServices.reconcileFutureShiftsForTaskChange(
        [task.room],
        task._id,
        null,
        managerId,
        force
    );

    const result = await Task.findByIdAndUpdate(
        id,
        { is_active: false, last_updated_by: managerId },
        { new: true }
    );

    await shiftServices.resyncTodayShiftTasksForRoomsIfDue([task.room]);
    await shiftServices.resyncFutureShiftTasksForRoomsIfDue([task.room]);

    return result;
};

// `managerId` is null only on the client's own path, which has already
// verified the room belongs to the calling client.
const getAllTasksByRoomFromDB = async (
    managerId: string | null,
    roomId: string,
    query: Record<string, unknown>
) => {
    const room = await Room.findOne({
        _id: roomId,
        is_active: true,
        ...(managerId && managerScope(managerId)),
    });
    if (!room) {
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    const taskQuery = new QueryBuilder(
        Task.find({
            room: roomId,
            is_active: true,
            ...(managerId && managerScope(managerId)),
        })
            .populate('client', 'name email phone company_name')
            .populate('location', 'name address')
            .populate('room', 'name room_type cleaning_type floor')
            .populate({
                path: 'last_updated_by',
                populate: { path: 'user', select: 'email phone' },
            }),
        query
    )
        .search(['name'])
        .filter()
        .fields()
        .paginate()
        .sort();

    const meta = await taskQuery.countTotal();
    const result = await taskQuery.modelQuery;

    return {
        meta,
        result,
    };
};

const getMyTasksFromDB = async (
    clientId: string,
    roomId: string,
    query: Record<string, unknown>
) => {
    const room = await Room.findOne({ _id: roomId, is_active: true }).populate<{
        location: { client: string };
    }>('location');

    if (!room || room.location?.client?.toString() !== clientId) {
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    return getAllTasksByRoomFromDB(null, roomId, query);
};

const getSingleTaskFromDB = async (managerId: string, id: string) => {
    const task = await Task.findOne({ _id: id, ...managerScope(managerId) })
        .populate('client', 'name email phone company_name')
        .populate('location', 'name address')
        .populate('room', 'name room_type cleaning_type floor')
        .populate({
            path: 'last_updated_by',
            populate: { path: 'user', select: 'email phone' },
        });

    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    return task;
};

const taskServices = {
    createTaskIntoDB,
    updateTaskIntoDB,
    deleteTaskFromDB,
    getAllTasksByRoomFromDB,
    getMyTasksFromDB,
    getSingleTaskFromDB,
};

export default taskServices;
