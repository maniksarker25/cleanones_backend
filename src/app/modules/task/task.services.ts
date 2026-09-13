import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { Room } from '../room/room.model';
import { TTask } from './task.interface';
import { Task } from './task.model';

const resolveRoomHierarchy = async (roomId: string) => {
    const room = await Room.findOne({ _id: roomId, is_active: true });

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
        room: room._id,
        location: populatedLocation._id,
        client: populatedLocation.client,
    };
};

const createTaskIntoDB = async (
    managerId: string,
    payload: Omit<TTask, 'client' | 'location'>
) => {
    const hierarchy = await resolveRoomHierarchy(payload.room.toString());

    const result = await Task.create({
        ...payload,
        client: hierarchy.client,
        location: hierarchy.location,
        room: hierarchy.room,
        last_updated_by: managerId,
    });

    return result;
};

const updateTaskIntoDB = async (
    managerId: string,
    id: string,
    payload: Omit<Partial<TTask>, 'client' | 'location' | 'room'>
) => {
    const task = await Task.findById(id);
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    const result = await Task.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );

    return result;
};

const deleteTaskFromDB = async (managerId: string, id: string) => {
    const task = await Task.findById(id);
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    const result = await Task.findByIdAndUpdate(
        id,
        { is_active: false, last_updated_by: managerId },
        { new: true }
    );

    return result;
};

const getAllTasksByRoomFromDB = async (
    roomId: string,
    query: Record<string, unknown>
) => {
    const room = await Room.findOne({ _id: roomId, is_active: true });
    if (!room) {
        throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    }

    const taskQuery = new QueryBuilder(
        Task.find({ room: roomId, is_active: true })
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

    return getAllTasksByRoomFromDB(roomId, query);
};

const getSingleTaskFromDB = async (id: string) => {
    const task = await Task.findById(id)
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
