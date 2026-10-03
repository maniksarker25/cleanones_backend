"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueReport = void 0;
const mongoose_1 = require("mongoose");
const issue_report_interface_1 = require("./issue_report.interface");
const issueReportSchema = new mongoose_1.Schema({
    worker: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true,
        immutable: true,
        index: true,
    },
    issueType: {
        type: String,
        required: true,
        trim: true,
    },
    severity: {
        type: String,
        enum: issue_report_interface_1.ISSUE_SEVERITY,
        required: true,
    },
    location: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: issue_report_interface_1.ISSUE_STATUS,
        default: 'PENDING',
    },
    resolution_note: {
        type: String,
        trim: true,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.IssueReport = (0, mongoose_1.model)('IssueReport', issueReportSchema, 'issue_reports');
