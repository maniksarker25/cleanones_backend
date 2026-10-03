"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoutes = void 0;
const express_1 = require("express");
const multer_s3_uploader_1 = require("../../helper/multer-s3-uploader");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const admin_controller_1 = __importDefault(require("./admin.controller"));
const admin_validation_1 = __importDefault(require("./admin.validation"));
const router = (0, express_1.Router)();
router.post('/create-admin', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), (0, multer_s3_uploader_1.uploadFile)(), (req, res, next) => {
    if (req.body.data) {
        req.body = JSON.parse(req.body.data);
    }
    next();
}, (0, validateRequest_1.default)(admin_validation_1.default.createAdminProfileValidationSchema), admin_controller_1.default.createAdmin);
router.patch('/update-admin', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), (0, multer_s3_uploader_1.uploadFile)(), (req, res, next) => {
    if (req.body.data) {
        req.body = JSON.parse(req.body.data);
    }
    next();
}, (0, validateRequest_1.default)(admin_validation_1.default.updateAdminProfileValidationSchema), admin_controller_1.default.updateAdminProfile);
router.delete('/delete-admin/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), admin_controller_1.default.deleteAdmin);
router.patch('/update-admin-status/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), admin_controller_1.default.updateShopStatus);
router.get('/all-admins', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), admin_controller_1.default.getAllAdmin);
exports.AdminRoutes = router;
