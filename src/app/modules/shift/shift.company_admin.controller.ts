import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import shiftCompanyAdminServices from './shift.company_admin.services';

const getAllShifts = catchAsync(async (req, res) => {
    const result = await shiftCompanyAdminServices.getAllShiftsForCompany(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shifts retrieved successfully',
        data: result,
    });
});

const getSingleShift = catchAsync(async (req, res) => {
    const result = await shiftCompanyAdminServices.getSingleShiftForCompany(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shift retrieved successfully',
        data: result,
    });
});

const getTodayShiftMeta = catchAsync(async (req, res) => {
    const result = await shiftCompanyAdminServices.getTodayShiftMetaForCompany(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Today's shift metadata retrieved successfully",
        data: result,
    });
});

export default { getAllShifts, getSingleShift, getTodayShiftMeta };
