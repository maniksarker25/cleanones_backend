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
const meta_service_1 = __importDefault(require("./meta.service"));
const getDashboardMetaData = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield meta_service_1.default.getDashboardMetaData();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Dashboard meta data retrieved successfully',
        data: result,
    });
}));
const getCustomerChartData = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield meta_service_1.default.getCustomerChartData(Number(req === null || req === void 0 ? void 0 : req.query.year));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User chart data retrieved successfully',
        data: result,
    });
}));
const getProviderChartData = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield meta_service_1.default.getProviderChartData(Number(req === null || req === void 0 ? void 0 : req.query.year));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Provider chart data retrieved successfully',
        data: result,
    });
}));
const getEarningChartData = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield meta_service_1.default.getEarningChartData(Number(req === null || req === void 0 ? void 0 : req.query.year));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Earning chart data retrieved successfully',
        data: result,
    });
}));
const getActivities = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield meta_service_1.default.getActivities(req === null || req === void 0 ? void 0 : req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Activities retrieved successfully',
        data: result,
    });
}));
const MetaController = {
    getDashboardMetaData,
    getCustomerChartData,
    getProviderChartData,
    getEarningChartData,
    getActivities,
};
exports.default = MetaController;
