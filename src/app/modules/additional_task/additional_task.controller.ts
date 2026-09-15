import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import additionalTaskServices from './additional_task.services';

// ─── Client: Create ───────────────────────────────────────────────────────────

const createAdditionalTask = catchAsync(async (req, res) => {
    const result = await additionalTaskServices.createAdditionalTaskIntoDB(
        req.body,
        { role: req.user.role as string, profileId: req.user.profileId as string }
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Additional task created successfully',
        data: result,
    });
});

// ─── Client: Update ───────────────────────────────────────────────────────────

const updateAdditionalTask = catchAsync(async (req, res) => {
    const result = await additionalTaskServices.updateAdditionalTaskIntoDB(
        req.params.id,
        req.body,
        { role: req.user.role as string, profileId: req.user.profileId as string }
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Additional task updated successfully',
        data: result,
    });
});

// ─── Client: Delete ───────────────────────────────────────────────────────────

const deleteAdditionalTask = catchAsync(async (req, res) => {
    const result = await additionalTaskServices.deleteAdditionalTaskFromDB(
        req.params.id,
        { role: req.user.role as string, profileId: req.user.profileId as string }
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Additional task deleted successfully',
        data: result,
    });
});

// ─── Manager: Approve ─────────────────────────────────────────────────────────

const approveAdditionalTask = catchAsync(async (req, res) => {
    const result = await additionalTaskServices.approveAdditionalTaskIntoDB(
        req.params.id,
        req.body.status,
        req.body.reject_reason,
        {
            duration_minutes: req.body.duration_minutes,
            photo_requirements: req.body.photo_requirements,
        }
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: `Additional task ${req.body.status === 'Approved' ? 'approved' : 'rejected'} successfully`,
        data: result,
    });
});

// ─── Get all by Cleaning Plan ─────────────────────────────────────────────────

const getAllAdditionalTasksByPlan = catchAsync(async (req, res) => {
    const result =
        await additionalTaskServices.getAllAdditionalTasksByPlanFromDB(
            req.query,
            { role: req.user.role as string, profileId: req.user.profileId as string }
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Additional tasks retrieved successfully',
        data: result,
    });
});

// ─── Get Single ───────────────────────────────────────────────────────────────

const getSingleAdditionalTask = catchAsync(async (req, res) => {
    const result =
        await additionalTaskServices.getSingleAdditionalTaskFromDB(
            req.params.id,
            { role: req.user.role as string, profileId: req.user.profileId as string }
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Additional task retrieved successfully',
        data: result,
    });
});

const additionalTaskController = {
    createAdditionalTask,
    updateAdditionalTask,
    deleteAdditionalTask,
    approveAdditionalTask,
    getAllAdditionalTasksByPlan,
    getSingleAdditionalTask,
};

export default additionalTaskController;
