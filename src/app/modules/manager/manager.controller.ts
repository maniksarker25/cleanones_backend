import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import { USER_ROLE } from '../user/user.constant';
import managerServices from './manager.services';

const createManager = catchAsync(async (req, res) => {
    const result = await managerServices.createManagerIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Manager created successfully',
        data: result,
    });
});

const createManagerForCompany = catchAsync(async (req, res) => {
    const { company, ...body } = req.body;
    const result = await managerServices.createManagerIntoDB(company, body);
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Manager created successfully',
        data: result,
    });
});

const getAllManagers = catchAsync(async (req, res) => {
    const result = await managerServices.getAllManagersFromDB(
        req.user.role === USER_ROLE.company_admin
            ? (req.user.profileId as string)
            : null,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Managers retrieved successfully',
        data: result,
    });
});

const getSingleManager = catchAsync(async (req, res) => {
    const result = await managerServices.getSingleManagerFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Manager retrieved successfully',
        data: result,
    });
});

const updateManager = catchAsync(async (req, res) => {
    const result = await managerServices.updateManagerIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Manager updated successfully',
        data: result,
    });
});

const blockManager = catchAsync(async (req, res) => {
    const result = await managerServices.setManagerBlockedInDB(
        req.user.profileId as string,
        req.params.id,
        true
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Manager blocked successfully',
        data: result,
    });
});

const unblockManager = catchAsync(async (req, res) => {
    const result = await managerServices.setManagerBlockedInDB(
        req.user.profileId as string,
        req.params.id,
        false
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Manager unblocked successfully',
        data: result,
    });
});

export default {
    createManager,
    createManagerForCompany,
    getAllManagers,
    getSingleManager,
    updateManager,
    blockManager,
    unblockManager,
};
