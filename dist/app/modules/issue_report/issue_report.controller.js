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
const issue_report_services_1 = __importDefault(require("./issue_report.services"));
const createIssueReport = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield issue_report_services_1.default.createIssueReportIntoDB(req.body, req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Issue report created successfully',
        data: result,
    });
}));
const updateIssueReport = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield issue_report_services_1.default.updateIssueReportIntoDB(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Issue report updated successfully',
        data: result,
    });
}));
const deleteIssueReport = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield issue_report_services_1.default.deleteIssueReportFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Issue report deleted successfully',
        data: result,
    });
}));
const getAllIssueReports = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield issue_report_services_1.default.getAllIssueReportsFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Issue reports retrieved successfully',
        data: result,
    });
}));
const getMyIssueReports = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield issue_report_services_1.default.getMyIssueReportsFromDB(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'My issue reports retrieved successfully',
        data: result,
    });
}));
exports.default = {
    getMyIssueReports,
    createIssueReport,
    updateIssueReport,
    deleteIssueReport,
    getAllIssueReports,
};
