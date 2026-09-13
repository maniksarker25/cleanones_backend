import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import roomServices from './room.services';

const createRoom = catchAsync(async (req, res) => {
    const result = await roomServices.createRoomIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Room created successfully',
        data: result,
    });
});

const updateRoom = catchAsync(async (req, res) => {
    const result = await roomServices.updateRoomIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Room updated successfully',
        data: result,
    });
});

const deleteRoom = catchAsync(async (req, res) => {
    const result = await roomServices.deleteRoomFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Room deleted successfully',
        data: result,
    });
});

const getAllRooms = catchAsync(async (req, res) => {
    const result = await roomServices.getAllRoomsFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Rooms retrieved successfully',
        data: result,
    });
});

const getAllRoomsByLocation = catchAsync(async (req, res) => {
    const result = await roomServices.getAllRoomsByLocationFromDB(
        req.params.locationId,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Rooms retrieved successfully',
        data: result,
    });
});

const getMyRooms = catchAsync(async (req, res) => {
    const result = await roomServices.getMyRoomsFromDB(
        req.user.profileId as string,
        req.params.locationId,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'My rooms retrieved successfully',
        data: result,
    });
});

const getSingleRoom = catchAsync(async (req, res) => {
    const result = await roomServices.getSingleRoomFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Room retrieved successfully',
        data: result,
    });
});

const roomController = {
    createRoom,
    updateRoom,
    deleteRoom,
    getAllRooms,
    getAllRoomsByLocation,
    getMyRooms,
    getSingleRoom,
};

export default roomController;
