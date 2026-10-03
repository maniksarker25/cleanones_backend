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
const superAdmin_services_1 = __importDefault(require("./superAdmin.services"));
const updateUserProfile = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const file = (_a = req.files) === null || _a === void 0 ? void 0 : _a.profile_image;
    if ((_b = req.files) === null || _b === void 0 ? void 0 : _b.profile_image) {
        req.body.profile_image = (0, multer_s3_uploader_1.getCloudFrontUrl)(file[0].key);
    }
    const result = yield superAdmin_services_1.default.updateSuperAdminProfile(req.user.profileId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Profile updated successfully',
        data: result,
    });
}));
const SuperAdminController = {
    updateUserProfile,
};
exports.default = SuperAdminController;
