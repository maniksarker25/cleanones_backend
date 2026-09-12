import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import workerServices from './worker.services';

const createWorker = catchAsync(async (req, res) => {
    const result = await workerServices.createWorkerIntoDB(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker created successfully',
        data: result,
    });
});

const updateWorker = catchAsync(async (req, res) => {
    const result = await workerServices.updateWorkerIntoDB(
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker updated successfully',
        data: result,
    });
});

const deleteWorker = catchAsync(async (req, res) => {
    const result = await workerServices.deleteWorkerFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker deleted successfully',
        data: result,
    });
});

const getAllWorkers = catchAsync(async (req, res) => {
    const result = await workerServices.getAllWorkersFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Workers retrieved successfully',
        data: result,
    });
});

const getSingleWorker = catchAsync(async (req, res) => {
    const result = await workerServices.getSingleWorkerFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker retrieved successfully',
        data: result,
    });
});

const updateMyAvailability = catchAsync(async (req, res) => {
    const result = await workerServices.updateMyAvailabilityIntoDB(
        req.user.id as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Availability updated successfully',
        data: result,
    });
});

export default {
    updateMyAvailability,
    createWorker,
    updateWorker,
    deleteWorker,
    getAllWorkers,
    getSingleWorker,
};
