import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import cleaningPlanServices from './cleaning_plan.services';

const createCleaningPlan = catchAsync(async (req, res) => {
    const result = await cleaningPlanServices.createCleaningPlanIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Cleaning plan created successfully',
        data: result,
    });
});

const updateCleaningPlan = catchAsync(async (req, res) => {
    const result = await cleaningPlanServices.updateCleaningPlanIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Cleaning plan updated successfully',
        data: result,
    });
});

const deleteCleaningPlan = catchAsync(async (req, res) => {
    const result = await cleaningPlanServices.deleteCleaningPlanFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Cleaning plan deleted successfully',
        data: result,
    });
});

const getAllCleaningPlans = catchAsync(async (req, res) => {
    const result = await cleaningPlanServices.getAllCleaningPlansFromDB(
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Cleaning plans retrieved successfully',
        data: result,
    });
});

const getMyCleaningPlans = catchAsync(async (req, res) => {
    const result = await cleaningPlanServices.getMyCleaningPlansFromDB(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'My cleaning plans retrieved successfully',
        data: result,
    });
});

const getSingleCleaningPlan = catchAsync(async (req, res) => {
    const result = await cleaningPlanServices.getSingleCleaningPlanFromDB(
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Cleaning plan retrieved successfully',
        data: result,
    });
});

const cleaningPlanController = {
    getMyCleaningPlans,
    createCleaningPlan,
    updateCleaningPlan,
    deleteCleaningPlan,
    getAllCleaningPlans,
    getSingleCleaningPlan,
};

export default cleaningPlanController;
