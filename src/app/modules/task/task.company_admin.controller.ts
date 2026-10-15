import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import taskCompanyAdminServices from './task.company_admin.services';

const getAllTasks = catchAsync(async (req, res) => {
    const result = await taskCompanyAdminServices.getAllTasksForCompany(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Tasks retrieved successfully',
        data: result,
    });
});

const getSingleTask = catchAsync(async (req, res) => {
    const result = await taskCompanyAdminServices.getSingleTaskForCompany(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Task retrieved successfully',
        data: result,
    });
});

export default { getAllTasks, getSingleTask };
