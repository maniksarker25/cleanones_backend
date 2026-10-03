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
const cleaning_plan_services_1 = __importDefault(require("./cleaning_plan.services"));
const createCleaningPlan = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield cleaning_plan_services_1.default.createCleaningPlanIntoDB(req.user.profileId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Cleaning plan created successfully',
        data: result,
    });
}));
const updateCleaningPlan = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield cleaning_plan_services_1.default.updateCleaningPlanIntoDB(req.user.profileId, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cleaning plan updated successfully',
        data: result,
    });
}));
const deleteCleaningPlan = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield cleaning_plan_services_1.default.deleteCleaningPlanFromDB(req.user.profileId, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cleaning plan deleted successfully',
        data: result,
    });
}));
const getAllCleaningPlans = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield cleaning_plan_services_1.default.getAllCleaningPlansFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cleaning plans retrieved successfully',
        data: result,
    });
}));
const getMyCleaningPlans = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield cleaning_plan_services_1.default.getMyCleaningPlansFromDB(req.user.profileId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'My cleaning plans retrieved successfully',
        data: result,
    });
}));
const getSingleCleaningPlan = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield cleaning_plan_services_1.default.getSingleCleaningPlanFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cleaning plan retrieved successfully',
        data: result,
    });
}));
const cleaningPlanController = {
    getMyCleaningPlans,
    createCleaningPlan,
    updateCleaningPlan,
    deleteCleaningPlan,
    getAllCleaningPlans,
    getSingleCleaningPlan,
};
exports.default = cleaningPlanController;
