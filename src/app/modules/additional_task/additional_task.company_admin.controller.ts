import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import additionalTaskCompanyAdminServices from './additional_task.company_admin.services';

const getAllAdditionalTasks = catchAsync(async (req, res) => {
    const result =
        await additionalTaskCompanyAdminServices.getAllAdditionalTasksForCompany(
            req.user.profileId as string,
            req.query
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Additional tasks retrieved successfully',
        data: result,
    });
});

const getSingleAdditionalTask = catchAsync(async (req, res) => {
    const result =
        await additionalTaskCompanyAdminServices.getSingleAdditionalTaskForCompany(
            req.user.profileId as string,
            req.params.id
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Additional task retrieved successfully',
        data: result,
    });
});

export default { getAllAdditionalTasks, getSingleAdditionalTask };
