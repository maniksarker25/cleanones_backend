import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import locationCompanyAdminServices from './location.company_admin.services';

const getAllLocations = catchAsync(async (req, res) => {
    const result =
        await locationCompanyAdminServices.getAllLocationsForCompany(
            req.user.profileId as string,
            req.query
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Locations retrieved successfully',
        data: result,
    });
});

const getSingleLocation = catchAsync(async (req, res) => {
    const result =
        await locationCompanyAdminServices.getSingleLocationForCompany(
            req.user.profileId as string,
            req.params.id
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Location retrieved successfully',
        data: result,
    });
});

export default { getAllLocations, getSingleLocation };
