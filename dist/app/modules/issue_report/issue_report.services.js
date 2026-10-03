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
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const location_model_1 = require("../location/location.model");
const issue_report_model_1 = require("./issue_report.model");
const issue_report_validation_1 = require("./issue_report.validation");
const validateId = (id) => {
    if (!(0, mongoose_1.isObjectIdOrHexString)(id)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid issue report ID');
    }
};
const ensureLocationExists = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const location = yield location_model_1.Location.findOne({ _id: id, is_active: true });
    if (!location) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Active location not found');
    }
});
const createIssueReportIntoDB = (payload, workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const body = issue_report_validation_1.issueReportBody.parse(payload);
    yield ensureLocationExists(body.location);
    const result = yield issue_report_model_1.IssueReport.create(Object.assign(Object.assign({}, body), { worker: workerId, status: 'PENDING' }));
    (0, eventEmitter_1.emitAppEvent)('issue_report.created', {
        issueId: result._id.toString(),
        workerId,
        issueType: result.issueType,
        severity: result.severity,
    });
    return result;
});
const updateIssueReportIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    validateId(id);
    const body = issue_report_validation_1.issueReportUpdateBody.parse(payload);
    if (body.location !== undefined)
        yield ensureLocationExists(body.location);
    const existing = yield issue_report_model_1.IssueReport.findById(id).select('status worker');
    if (!existing)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Issue report not found');
    const statusChanged = body.status !== undefined && body.status !== existing.status;
    const result = yield issue_report_model_1.IssueReport.findByIdAndUpdate(id, { $set: body }, {
        new: true,
        runValidators: true,
    });
    if (!result)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Issue report not found');
    if (statusChanged) {
        (0, eventEmitter_1.emitAppEvent)('issue_report.status_changed', {
            issueId: result._id.toString(),
            workerId: existing.worker.toString(),
            status: result.status,
            resolutionNote: (_a = result.resolution_note) !== null && _a !== void 0 ? _a : null,
        });
    }
    return result;
});
const deleteIssueReportFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const result = yield issue_report_model_1.IssueReport.findByIdAndDelete(id);
    if (!result)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Issue report not found');
    return result;
});
const getAllIssueReportsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    return issue_report_model_1.IssueReport.find().sort('-createdAt');
});
const getMyIssueReportsFromDB = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    return issue_report_model_1.IssueReport.find({ worker: workerId }).sort({ createdAt: -1, _id: -1 });
});
exports.default = {
    getMyIssueReportsFromDB,
    createIssueReportIntoDB,
    updateIssueReportIntoDB,
    deleteIssueReportFromDB,
    getAllIssueReportsFromDB,
};
