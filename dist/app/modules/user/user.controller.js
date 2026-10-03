"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const http_status_1 = __importDefault(require("http-status"));
const multer_s3_uploader_1 = require("../../helper/multer-s3-uploader");
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const user_constant_1 = require("./user.constant");
const user_services_1 = __importDefault(require("./user.services"));
const registerUser = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_services_1.default.registerUser(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User registration successful. Check email for verify your account',
        data: result,
    });
}));
const verifyCode = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const result = yield user_services_1.default.verifyCode((_a = req === null || req === void 0 ? void 0 : req.body) === null || _a === void 0 ? void 0 : _a.email, (_b = req === null || req === void 0 ? void 0 : req.body) === null || _b === void 0 ? void 0 : _b.verifyCode);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Successfully verified your account with email',
        data: result,
    });
}));
const resendVerifyCode = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const result = yield user_services_1.default.resendVerifyCode((_c = req === null || req === void 0 ? void 0 : req.body) === null || _c === void 0 ? void 0 : _c.email);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Verify code send to your email inbox',
        data: result,
    });
}));
const getMyProfile = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_services_1.default.getMyProfile(req.user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Successfully retrieved your data',
        data: result,
    });
}));
const updateUserProfile = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e;
    const file = (_d = req.files) === null || _d === void 0 ? void 0 : _d.profile_image;
    if ((_e = req.files) === null || _e === void 0 ? void 0 : _e.profile_image) {
        req.body.profile_image = (0, multer_s3_uploader_1.getCloudFrontUrl)(file[0].key);
    }
    const result = yield user_services_1.default.updateUserProfile(req.user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Profile updated successfully',
        data: result,
    });
}));
const changeUserStatus = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_services_1.default.changeUserStatus(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `${(result === null || result === void 0 ? void 0 : result.role) == user_constant_1.USER_ROLE.client ? 'Customer' : 'Provider'} is ${(result === null || result === void 0 ? void 0 : result.isBlocked) ? 'Blocked' : 'Unblocked'}`,
        data: result,
    });
}));
const deleteUserAccount = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_services_1.default.deleteUserAccount(req.user, req.body.password);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Your account deleted successfully`,
        data: result,
    });
}));
const upgradeAccount = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_services_1.default.upgradeAccount(req.user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: result.data,
    });
}));
const userController = {
    registerUser,
    verifyCode,
    resendVerifyCode,
    getMyProfile,
    changeUserStatus,
    deleteUserAccount,
    updateUserProfile,
    upgradeAccount,
};
exports.default = userController;
