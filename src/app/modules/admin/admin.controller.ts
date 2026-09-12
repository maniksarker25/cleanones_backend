/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { getCloudFrontUrl } from '../../helper/multer-s3-uploader';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import AdminServices from './admin.services';

const createAdmin = catchAsync(async (req, res) => {
    const file: any = req.files?.profile_image;
    if (req.files?.profile_image) {
        req.body.profile_image = getCloudFrontUrl(file[0].key);
    }
    const result = await AdminServices.createAdminIntoDB(req?.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin profile created successfully',
        data: result,
    });
});
const updateAdminProfile = catchAsync(async (req, res) => {
    const file: any = req.files?.profile_image;
    if (req.files?.profile_image) {
        req.body.profile_image = getCloudFrontUrl(file[0].key);
    }
    const result = await AdminServices.updateAdminProfile(
        req?.user?.id,
        req?.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin profile updated successfully',
        data: result,
    });
});

const deleteAdmin = catchAsync(async (req, res) => {
    const result = await AdminServices.deleteAdminFromDB(req?.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin deleted successfully',
        data: result,
    });
});

// update shop status
const updateAdminStatus = catchAsync(async (req, res) => {
    const result = await AdminServices.updateAdminStatus(req?.params?.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.isActive
            ? 'Admin activated successfully'
            : 'Admin deactivated successfully',
        data: result,
    });
});
const getAllAdmin = catchAsync(async (req, res) => {
    const result = await AdminServices.getAllAdminFromDB(req?.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin retrieved successfully',
        data: result,
    });
});

const AdminController = {
    updateAdminProfile,
    updateShopStatus: updateAdminStatus,
    getAllAdmin,
    deleteAdmin,
    createAdmin,
};

export default AdminController;
