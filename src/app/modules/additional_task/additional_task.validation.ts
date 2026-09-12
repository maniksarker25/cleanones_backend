import { z } from 'zod';

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
