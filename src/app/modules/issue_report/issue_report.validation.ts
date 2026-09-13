import { z } from 'zod';
import { ISSUE_SEVERITY } from './issue_report.interface';

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
        isResolved: z.boolean(),
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
