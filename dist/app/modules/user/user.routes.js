"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const rateLimit_config_1 = require("../../config/rateLimit.config");
const multer_s3_uploader_1 = require("../../helper/multer-s3-uploader");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const parseJsonBody_1 = __importDefault(require("../../middlewares/parseJsonBody"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("./user.constant");
const user_controller_1 = __importDefault(require("./user.controller"));
const user_validation_1 = __importDefault(require("./user.validation"));
const router = (0, express_1.Router)();
router.post('/sign-up', rateLimit_config_1.authLimiter, (0, validateRequest_1.default)(user_validation_1.default.registerUserValidationSchema), user_controller_1.default.registerUser);
//
router.post('/verify-code', rateLimit_config_1.authLimiter, (0, validateRequest_1.default)(user_validation_1.default.verifyCodeValidationSchema), user_controller_1.default.verifyCode);
router.post('/resend-verify-code', rateLimit_config_1.authLimiter, (0, validateRequest_1.default)(user_validation_1.default.resendVerifyCodeSchema), user_controller_1.default.resendVerifyCode);
router.get('/get-my-profile', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker, user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.manager), user_controller_1.default.getMyProfile);
router.patch('/update-profile', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker, user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.manager), (0, multer_s3_uploader_1.uploadFile)(), (0, parseJsonBody_1.default)(), (0, validateRequest_1.default)(user_validation_1.default.updateUserProfileValidationSchema), user_controller_1.default.updateUserProfile);
//===
router.patch('/block-unblock/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin), user_controller_1.default.changeUserStatus);
router.post('/delete-account', (0, auth_1.default)(user_constant_1.USER_ROLE.client), (0, validateRequest_1.default)(user_validation_1.default.deleteUserAccountValidationSchema), user_controller_1.default.deleteUserAccount);
router.post('/upgrade-account', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), user_controller_1.default.upgradeAccount);
exports.userRoutes = router;
