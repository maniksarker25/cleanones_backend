import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import workerCompanyAdminServices from './worker.company_admin.services';

const getAllWorkers = catchAsync(async (req, res) => {
    const result = await workerCompanyAdminServices.getAllWorkersForCompany(
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
    const result = await workerCompanyAdminServices.getSingleWorkerForCompany(
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

export default { getAllWorkers, getSingleWorker };
