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
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = __importDefault(require("../../error/appError"));
const deleteFromS3_1 = require("../../helper/deleteFromS3");
const superAdmin_model_1 = __importDefault(require("./superAdmin.model"));
const updateSuperAdminProfile = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (payload.email) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'You can not change the email');
    }
    const user = yield superAdmin_model_1.default.findById(id);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
    }
    const result = yield superAdmin_model_1.default.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    if (payload.profile_image && user.profile_image) {
        (0, deleteFromS3_1.deleteFileFromS3)(user.profile_image);
    }
    return result;
});
const SuperAdminServices = {
    updateSuperAdminProfile,
};
exports.default = SuperAdminServices;
