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
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const notification_services_1 = __importDefault(require("./notification.services"));
const getAllNotification = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_services_1.default.getAllNotificationFromDB(req === null || req === void 0 ? void 0 : req.query, req === null || req === void 0 ? void 0 : req.user);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Notification retrieved successfully',
        data: result,
    });
}));
const seeNotification = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_services_1.default.seeNotification(req === null || req === void 0 ? void 0 : req.user);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Notification seen successfully',
        data: result,
    });
}));
const deleteNotification = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_services_1.default.deleteNotification(req.params.id, req.user);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Notification removed',
        data: result,
    });
}));
const notificationController = {
    getAllNotification,
    seeNotification,
    deleteNotification,
};
exports.default = notificationController;
