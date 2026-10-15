import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import clientCompanyAdminServices from './client.company_admin.services';

const getAllClients = catchAsync(async (req, res) => {
    const result = await clientCompanyAdminServices.getAllClientsForCompany(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Clients retrieved successfully',
        data: result,
    });
});

const getSingleClient = catchAsync(async (req, res) => {
    const result = await clientCompanyAdminServices.getSingleClientForCompany(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client retrieved successfully',
        data: result,
    });
});

export default { getAllClients, getSingleClient };
