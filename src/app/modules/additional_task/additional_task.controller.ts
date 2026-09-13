import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import additionalTaskServices from './additional_task.services';

// ─── Client: Create ───────────────────────────────────────────────────────────

const createAdditionalTask = catchAsync(async (req, res) => {
    const result =
        await additionalTaskServices.createAdditionalTaskIntoDB(req.body);
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
        req.body
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
        req.params.id
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
        req.body.is_approved
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: `Additional task ${req.body.is_approved ? 'approved' : 'rejected'} successfully`,
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
            req.params.id
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
