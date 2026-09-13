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

const uploadTaskPhotoValidationSchema = z.object({
    body: z.object({
        title: z.string({ required_error: 'title is required' }).min(1).trim(),
        photo_url: z
            .string({ required_error: 'photo_url is required' })
            .min(1)
            .trim(),
    }),
});

const checkInOutValidationSchema = z.object({
    body: z.object({
        latitude: z.coerce.number({ required_error: 'latitude is required' }).min(-90).max(90),
        longitude: z.coerce.number({ required_error: 'longitude is required' }).min(-180).max(180),
    }),
});

const shiftValidations = {
    workerShiftsQuery: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD').refine(
            (value) => {
                const date = new Date(value);
                return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
            },
            'Date must be a valid calendar date'
        ),
    }).strict(),
    assignWorkersValidationSchema,
    updateStatusValidationSchema,
    uploadTaskPhotoValidationSchema,
    checkInOutValidationSchema,
};

export default shiftValidations;
