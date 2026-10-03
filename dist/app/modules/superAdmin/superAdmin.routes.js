"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminRoutes = void 0;
const express_1 = __importDefault(require("express"));
const multer_s3_uploader_1 = require("../../helper/multer-s3-uploader");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const superAdmin_controller_1 = __importDefault(require("./superAdmin.controller"));
const superAdmin_validation_1 = __importDefault(require("./superAdmin.validation"));
const router = express_1.default.Router();
router.patch('/update-profile', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), (0, multer_s3_uploader_1.uploadFile)(), (req, res, next) => {
    if (req.body.data) {
        req.body = JSON.parse(req.body.data);
    }
    next();
}, (0, validateRequest_1.default)(superAdmin_validation_1.default.updateSuperAdminSchema), superAdmin_controller_1.default.updateUserProfile);
exports.superAdminRoutes = router;
