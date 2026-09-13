import { z } from 'zod';

const assignedWorkerSchema = z.object({
    worker: z.string({ required_error: 'Worker ID is required' }),
    role: z.enum(['Team leader', 'Co-leader', 'Normal worker'], {
        required_error: 'Worker role is required',
    }),
});

const assignWorkersValidationSchema = z.object({
    body: z.object({
        assigned_workers: z
            .array(assignedWorkerSchema)
            .min(1, 'At least one worker is required'),
        force: z.coerce.boolean().optional(),
    }),
});

const updateStatusValidationSchema = z.object({
    body: z.object({
        status: z.enum(['upcoming', 'in_progress', 'completed', 'cancelled'], {
            required_error: 'Status is required',
        }),
    }),
});

const shiftValidations = {
    assignWorkersValidationSchema,
    updateStatusValidationSchema,
};

export default shiftValidations;
