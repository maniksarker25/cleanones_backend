import { z } from 'zod';

const createCleaningPlanValidationSchema = z.object({
    body: z.object({
        title: z.string({ required_error: 'Title is required' }).min(1).trim(),
        description: z
            .string({ required_error: 'Description is required' })
            .min(1)
            .trim(),
        client: z.string({ required_error: 'Client is required' }),
        location: z.string({ required_error: 'Location is required' }),
        rooms: z.array(z.string()).optional(),
        note: z.string().nullable().optional(),
        status: z.enum(['active', 'inactive', 'completed']).optional(),
    }),
});

const updateCleaningPlanValidationSchema = z.object({
    body: z
        .object({
            title: z.string().min(1).trim().optional(),
            description: z.string().min(1).trim().optional(),
            rooms: z.array(z.string()).optional(),
            note: z.string().nullable().optional(),
            status: z.enum(['active', 'inactive', 'completed']).optional(),
        })
        .partial(),
});

const cleaningPlanValidations = {
    createCleaningPlanValidationSchema,
    updateCleaningPlanValidationSchema,
};

export default cleaningPlanValidations;
