import { z } from 'zod';

const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true').optional();
export const additionalTaskListQuerySchema = z.object({
    planId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid planId').optional(),
    page: z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0).optional(),
    searchTerm: z.string().optional(),
    sort: z.string().regex(/^-?(name|description|duration_minutes|date_time|created_at|updated_at|is_approved|is_completed)$/).optional(),
    is_approved: queryBoolean,
    is_completed: queryBoolean,
    is_photo_required: queryBoolean,
});

const photoRequirementSchema = z.object({
    title: z.string().min(1, 'Photo title is required').trim(),
    photo_url: z.string().nullable().optional(),
    is_uploaded: z.boolean().optional(),
});

const createAdditionalTaskValidationSchema = z.object({
    body: z.object({
        cleaning_plan_id: z.string({
            required_error: 'Cleaning plan ID is required',
        }),
        name: z
            .string({ required_error: 'Name is required' })
            .min(1)
            .trim(),
        description: z.string().trim().optional(),
        duration_minutes: z.number({
            required_error: 'Duration is required',
        }).min(0),
        is_photo_required: z.boolean().optional(),
        photo_requirements: z.array(photoRequirementSchema).optional(),
        date_time: z.coerce.date({
            required_error: 'Date and time is required',
        }),
    }),
});

const updateAdditionalTaskValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1).trim().optional(),
            description: z.string().trim().optional(),
            duration_minutes: z.number().min(0).optional(),
            is_photo_required: z.boolean().optional(),
            photo_requirements: z.array(photoRequirementSchema).optional(),
            date_time: z.coerce.date().optional(),
            is_completed: z.boolean().optional(),
        })
        .partial(),
});

const approveAdditionalTaskValidationSchema = z.object({
    body: z.object({
        is_approved: z.boolean({
            required_error: 'is_approved is required',
        }),
    }),
});

const additionalTaskValidations = {
    createAdditionalTaskValidationSchema,
    updateAdditionalTaskValidationSchema,
    approveAdditionalTaskValidationSchema,
};

export default additionalTaskValidations;
