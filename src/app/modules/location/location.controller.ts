import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import locationServices from './location.services';

const createLocation = catchAsync(async (req, res) => {
    const result = await locationServices.createLocationIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Location created successfully',
        data: result,
    });
});

const updateLocation = catchAsync(async (req, res) => {
    const result = await locationServices.updateLocationIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Location updated successfully',
        data: result,
    });
});

const deleteLocation = catchAsync(async (req, res) => {
    const result = await locationServices.deleteLocationFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Location deleted successfully',
        data: result,
    });
});

const getAllLocations = catchAsync(async (req, res) => {
    const result = await locationServices.getAllLocationsFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Locations retrieved successfully',
        data: result,
    });
});

const getClientLocations = catchAsync(async (req, res) => {
    const result = await locationServices.getClientLocationsFromDB(
        req.params.clientId,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client locations retrieved successfully',
        data: result,
    });
});

const getWorkerLocations = catchAsync(async (req, res) => {
    const result = await locationServices.getWorkerLocationsFromDB(
        req.params.workerId,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker locations retrieved successfully',
        data: result,
    });
});

// Client: get their own locations
const getMyLocations = catchAsync(async (req, res) => {
    const result = await locationServices.getMyLocationsFromDB(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'My locations retrieved successfully',
        data: result,
    });
});

const getSingleLocation = catchAsync(async (req, res) => {
    const result = await locationServices.getSingleLocationFromDB(
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Location retrieved successfully',
        data: result,
    });
});

const locationController = {
    createLocation,
    updateLocation,
    deleteLocation,
    getAllLocations,
    getClientLocations,
    getWorkerLocations,
    getSingleLocation,
    getMyLocations,
};

export default locationController;
