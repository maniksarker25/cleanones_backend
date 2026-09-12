/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { getCloudFrontUrl } from '../../helper/multer-s3-uploader';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import SuperAdminServices, { EarningsService } from './superAdmin.services';

const updateUserProfile = catchAsync(async (req, res) => {
    const file: any = req.files?.profile_image;
    if (req.files?.profile_image) {
        req.body.profile_image = getCloudFrontUrl(file[0].key);
    }
    const result = await SuperAdminServices.updateSuperAdminProfile(
        req.user.profileId,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Profile updated successfully',
        data: result,
    });
});

const getEarningsMatrix = catchAsync(async (req, res) => {
    const { filter, page, limit } = req.query;

    const result = await EarningsService.getEarningsMatrix({
        filter: (filter as string) || 'today',
        page: Number(page) || 1,
        limit: Number(limit) || 10,
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Earnings matrix fetched successfully',
        data: result,
    });
});

const SuperAdminController = {
    updateUserProfile,
    getEarningsMatrix,
};

export default SuperAdminController;
