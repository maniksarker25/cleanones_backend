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
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const additional_task_services_1 = __importDefault(require("./additional_task.services"));
// ─── Client: Create ───────────────────────────────────────────────────────────
const createAdditionalTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield additional_task_services_1.default.createAdditionalTaskIntoDB(req.body, { role: req.user.role, profileId: req.user.profileId });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Additional task created successfully',
        data: result,
    });
}));
// ─── Client: Update ───────────────────────────────────────────────────────────
const updateAdditionalTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield additional_task_services_1.default.updateAdditionalTaskIntoDB(req.params.id, req.body, { role: req.user.role, profileId: req.user.profileId });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Additional task updated successfully',
        data: result,
    });
}));
// ─── Client: Delete ───────────────────────────────────────────────────────────
const deleteAdditionalTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield additional_task_services_1.default.deleteAdditionalTaskFromDB(req.params.id, { role: req.user.role, profileId: req.user.profileId });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Additional task deleted successfully',
        data: result,
    });
}));
// ─── Manager: Approve ─────────────────────────────────────────────────────────
const approveAdditionalTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield additional_task_services_1.default.approveAdditionalTaskIntoDB(req.params.id, req.body.status, req.body.reject_reason, {
        duration_minutes: req.body.duration_minutes,
        photo_requirements: req.body.photo_requirements,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Additional task ${req.body.status === 'Approved' ? 'approved' : 'rejected'} successfully`,
        data: result,
    });
}));
// ─── Get all by Cleaning Plan ─────────────────────────────────────────────────
const getAllAdditionalTasksByPlan = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield additional_task_services_1.default.getAllAdditionalTasksByPlanFromDB(req.query, { role: req.user.role, profileId: req.user.profileId });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Additional tasks retrieved successfully',
        data: result,
    });
}));
// ─── Get Single ───────────────────────────────────────────────────────────────
const getSingleAdditionalTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield additional_task_services_1.default.getSingleAdditionalTaskFromDB(req.params.id, { role: req.user.role, profileId: req.user.profileId });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Additional task retrieved successfully',
        data: result,
    });
}));
const additionalTaskController = {
    createAdditionalTask,
    updateAdditionalTask,
    deleteAdditionalTask,
    approveAdditionalTask,
    getAllAdditionalTasksByPlan,
    getSingleAdditionalTask,
};
exports.default = additionalTaskController;
