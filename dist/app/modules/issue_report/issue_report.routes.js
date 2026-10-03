"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueReportRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const issue_report_controller_1 = __importDefault(require("./issue_report.controller"));
const issue_report_validation_1 = __importDefault(require("./issue_report.validation"));
const router = (0, express_1.Router)();
router.get('/get-my-issue-report', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), issue_report_controller_1.default.getMyIssueReports);
router.post('/create-issue-report', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), (0, validateRequest_1.default)(issue_report_validation_1.default.createIssueReportValidationSchema), issue_report_controller_1.default.createIssueReport);
router.patch('/update-issue-report/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(issue_report_validation_1.default.updateIssueReportValidationSchema), issue_report_controller_1.default.updateIssueReport);
router.delete('/delete-issue-report/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), issue_report_controller_1.default.deleteIssueReport);
router.get('/all-issue-reports', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), issue_report_controller_1.default.getAllIssueReports);
exports.issueReportRoutes = router;
