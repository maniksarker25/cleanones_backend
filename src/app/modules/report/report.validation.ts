import { z } from 'zod';
import { ENUM_REPORT_ROLE } from './report.enum';

export const createReportValidationSchema = z.object({
    body: z.object({
        reportTo: z
            .string({ required_error: 'reportTo is required' })
            .regex(/^[a-fA-F0-9]{24}$/, 'reportTo must be a valid ObjectId'),

        reportToRole: z.enum(
            Object.values(ENUM_REPORT_ROLE) as [string, ...string[]],
            {
                required_error: 'reportToRole is required',
            }
        ),

        task: z
            .string({ required_error: 'task is required' })
            .regex(/^[a-fA-F0-9]{24}$/, 'task must be a valid ObjectId'),

        reason: z
            .string({ required_error: 'reason is required' })
            .trim()
            .min(1, 'reason cannot be empty'),

        evidence: z.array(z.string()).default([]),

        isResolved: z.boolean().default(false),

        resolutionNote: z.string().nullable().default(null),
    }),
});

export const updateReportValidationSchema = z.object({
    body: z.object({
        isResolved: z.boolean().optional(),
        resolutionNote: z.string().nullable().optional(),
        evidence: z.array(z.string()).optional(),
        reason: z.string().trim().min(1).optional(),
    }),
});

const ReportValidations = {
    createReportValidationSchema,
    updateReportValidationSchema,
};

export default ReportValidations;
