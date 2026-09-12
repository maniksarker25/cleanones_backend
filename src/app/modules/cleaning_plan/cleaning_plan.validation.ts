import { z } from 'zod';

const assignedWorkerSchema = z.object({
    worker: z.string({ required_error: 'Worker ID is required' }),
    role: z.enum(['Team leader', 'Co-leader', 'Normal worker'], {
        required_error: 'Worker role is required',
    }),
});

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
        assigned_workers: z.array(assignedWorkerSchema).optional(),
        start_date: z.coerce.date({ required_error: 'Start date is required' }),
        start_time: z
            .string({ required_error: 'Start time is required' })
            .trim(),
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
            assigned_workers: z.array(assignedWorkerSchema).optional(),
            start_date: z.coerce.date().optional(),
            start_time: z.string().trim().optional(),
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
