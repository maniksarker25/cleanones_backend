import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import workerServices from './worker.services';

const createWorker = catchAsync(async (req, res) => {
    const result = await workerServices.createWorkerIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker created successfully',
        data: result,
    });
});

const updateWorker = catchAsync(async (req, res) => {
    const result = await workerServices.updateWorkerIntoDB(
        req.user.profileId as string,
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
    const result = await workerServices.deleteWorkerFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker deleted successfully',
        data: result,
    });
});

const getAllWorkers = catchAsync(async (req, res) => {
    const result = await workerServices.getAllWorkersFromDB(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Workers retrieved successfully',
        data: result,
    });
});

const getSingleWorker = catchAsync(async (req, res) => {
    const result = await workerServices.getSingleWorkerFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker retrieved successfully',
        data: result,
    });
});

const bulkUploadWorkers = catchAsync(async (req, res) => {
    const result = await workerServices.bulkCreateWorkersFromCsv(
        req.user.profileId as string,
        (req.file as Express.Multer.File).buffer
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: `${result.created_count} of ${result.total} worker(s) created`,
        data: result,
    });
});

const getMyAvailability = catchAsync(async (req, res) => {
    const result = await workerServices.getMyAvailabilityFromDB(
        req.user.id as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Availability retrieved successfully',
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
    bulkUploadWorkers,
    getMyAvailability,
    updateMyAvailability,
    createWorker,
    updateWorker,
    deleteWorker,
    getAllWorkers,
    getSingleWorker,
};
