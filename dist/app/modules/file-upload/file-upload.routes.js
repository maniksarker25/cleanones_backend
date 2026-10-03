"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUploadRoutes = void 0;
const express_1 = __importDefault(require("express"));
const multer_s3_uploader_1 = require("../../helper/multer-s3-uploader");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const file_upload_controller_1 = __importDefault(require("./file-upload.controller"));
const router = express_1.default.Router();
router.post('/upload-conversation-files', (0, auth_1.default)(user_constant_1.USER_ROLE.worker, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.manager), (0, multer_s3_uploader_1.uploadFile)(), file_upload_controller_1.default.uploadConversationFiles);
router.post('/delete-files', (0, auth_1.default)(user_constant_1.USER_ROLE.worker, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.manager), file_upload_controller_1.default.deleteFiles);
exports.fileUploadRoutes = router;
