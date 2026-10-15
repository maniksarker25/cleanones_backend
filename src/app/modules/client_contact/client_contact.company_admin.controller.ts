import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import clientContactCompanyAdminServices from './client_contact.company_admin.services';

const getAllClientContacts = catchAsync(async (req, res) => {
    const result =
        await clientContactCompanyAdminServices.getAllClientContactsForCompany(
            req.user.profileId as string,
            req.query
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client contacts retrieved successfully',
        data: result,
    });
});

const getSingleClientContact = catchAsync(async (req, res) => {
    const result =
        await clientContactCompanyAdminServices.getSingleClientContactForCompany(
            req.user.profileId as string,
            req.params.id
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client contact retrieved successfully',
        data: result,
    });
});

export default { getAllClientContacts, getSingleClientContact };
