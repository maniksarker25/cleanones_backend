import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import cleaningPlanCompanyAdminServices from './cleaning_plan.company_admin.services';

const getAllCleaningPlans = catchAsync(async (req, res) => {
    const result =
        await cleaningPlanCompanyAdminServices.getAllCleaningPlansForCompany(
            req.user.profileId as string,
            req.query
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Cleaning plans retrieved successfully',
        data: result,
    });
});

const getSingleCleaningPlan = catchAsync(async (req, res) => {
    const result =
        await cleaningPlanCompanyAdminServices.getSingleCleaningPlanForCompany(
            req.user.profileId as string,
            req.params.id
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Cleaning plan retrieved successfully',
        data: result,
    });
});

export default { getAllCleaningPlans, getSingleCleaningPlan };
