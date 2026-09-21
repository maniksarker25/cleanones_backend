import { z } from 'zod';
import { ISSUE_SEVERITY, ISSUE_STATUS } from './issue_report.interface';

export const issueReportBody = z
    .object({
        issueType: z.string().trim().min(1, 'Issue type is required'),
        severity: z.enum(ISSUE_SEVERITY),
        location: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid location ID'),
        description: z.string().trim().min(1, 'Description is required'),
    })
    .strict();

export const issueReportUpdateBody = issueReportBody
    .extend({
        status: z.enum(ISSUE_STATUS),
        resolution_note: z.string().trim().min(1).nullable(),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
        message: 'At least one field is required',
    });

export default {
    createIssueReportValidationSchema: z.object({ body: issueReportBody }),
    updateIssueReportValidationSchema: z.object({
        body: issueReportUpdateBody,
    }),
};
