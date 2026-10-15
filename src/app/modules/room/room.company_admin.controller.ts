import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import roomCompanyAdminServices from './room.company_admin.services';

const getAllRooms = catchAsync(async (req, res) => {
    const result = await roomCompanyAdminServices.getAllRoomsForCompany(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Rooms retrieved successfully',
        data: result,
    });
});

const getSingleRoom = catchAsync(async (req, res) => {
    const result = await roomCompanyAdminServices.getSingleRoomForCompany(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Room retrieved successfully',
        data: result,
    });
});

export default { getAllRooms, getSingleRoom };
