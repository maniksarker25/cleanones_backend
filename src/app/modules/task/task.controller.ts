import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import taskServices from './task.services';

const createTask = catchAsync(async (req, res) => {
    const result = await taskServices.createTaskIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Task created successfully',
        data: result,
    });
});

const updateTask = catchAsync(async (req, res) => {
    const result = await taskServices.updateTaskIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Task updated successfully',
        data: result,
    });
});

const deleteTask = catchAsync(async (req, res) => {
    const result = await taskServices.deleteTaskFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Task deleted successfully',
        data: result,
    });
});

const getAllTasksByRoom = catchAsync(async (req, res) => {
    const result = await taskServices.getAllTasksByRoomFromDB(
        req.params.roomId,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Tasks retrieved successfully',
        data: result,
    });
});

const getMyTasks = catchAsync(async (req, res) => {
    const result = await taskServices.getMyTasksFromDB(
        req.user.profileId as string,
        req.params.roomId,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'My tasks retrieved successfully',
        data: result,
    });
});

const getSingleTask = catchAsync(async (req, res) => {
    const result = await taskServices.getSingleTaskFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Task retrieved successfully',
        data: result,
    });
});

const taskController = {
    createTask,
    updateTask,
    deleteTask,
    getAllTasksByRoom,
    getMyTasks,
    getSingleTask,
};

export default taskController;
