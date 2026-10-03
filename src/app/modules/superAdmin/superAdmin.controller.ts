import httpStatus from 'http-status';
import { getCloudFrontUrl } from '../../helper/multer-s3-uploader';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import SuperAdminServices from './superAdmin.services';

const updateUserProfile = catchAsync(async (req, res) => {
    const file = req.files?.profile_image;
    if (file?.length) {
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


const SuperAdminController = {
    updateUserProfile,
};

export default SuperAdminController;
