"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueReportUpdateBody = exports.issueReportBody = void 0;
const zod_1 = require("zod");
const issue_report_interface_1 = require("./issue_report.interface");
exports.issueReportBody = zod_1.z
    .object({
    issueType: zod_1.z.string().trim().min(1, 'Issue type is required'),
    severity: zod_1.z.enum(issue_report_interface_1.ISSUE_SEVERITY),
    location: zod_1.z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid location ID'),
    description: zod_1.z.string().trim().min(1, 'Description is required'),
})
    .strict();
exports.issueReportUpdateBody = exports.issueReportBody
    .extend({
    status: zod_1.z.enum(issue_report_interface_1.ISSUE_STATUS),
    resolution_note: zod_1.z.string().trim().min(1).nullable(),
})
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
});
exports.default = {
    createIssueReportValidationSchema: zod_1.z.object({ body: exports.issueReportBody }),
    updateIssueReportValidationSchema: zod_1.z.object({
        body: exports.issueReportUpdateBody,
    }),
};
