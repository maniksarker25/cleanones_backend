import { z } from 'zod';
import { WEEKDAYS } from './task.interface';

const frequencyFieldsRefinement = (
    data: {
        frequency_type?: string;
        days_of_week?: string[];
        days_of_month?: number[];
    },
    ctx: z.RefinementCtx
) => {
    if (
        data.frequency_type === 'weekly' &&
        (!data.days_of_week || data.days_of_week.length === 0)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'days_of_week is required for weekly tasks',
            path: ['days_of_week'],
        });
    }

    if (
        data.frequency_type === 'monthly' &&
        (!data.days_of_month || data.days_of_month.length === 0)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'days_of_month is required for monthly tasks',
            path: ['days_of_month'],
        });
    }
};

const createTaskValidationSchema = z.object({
    body: z
        .object({
            room: z.string({ required_error: 'Room is required' }),
            name: z.string({ required_error: 'Name is required' }).min(1),
            frequency_type: z.enum(['daily', 'weekly', 'monthly'], {
                required_error: 'Frequency type is required',
            }),
            is_photo_required: z.boolean().optional(),
            duration_minutes: z.coerce.number().positive().optional(),
            days_of_week: z.array(z.enum(WEEKDAYS)).optional(),
            days_of_month: z.array(z.number().min(1).max(31)).optional(),
            is_active: z.boolean().optional(),
        })
        .superRefine(frequencyFieldsRefinement),
});

const updateTaskValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, 'Name cannot be empty').optional(),
            frequency_type: z.enum(['daily', 'weekly', 'monthly']).optional(),
            is_photo_required: z.boolean().optional(),
            duration_minutes: z.coerce.number().positive().optional(),
            days_of_week: z.array(z.enum(WEEKDAYS)).optional(),
            days_of_month: z.array(z.number().min(1).max(31)).optional(),
            is_active: z.boolean().optional(),
        })
        .partial()
        .superRefine(frequencyFieldsRefinement),
});

const taskValidations = {
    createTaskValidationSchema,
    updateTaskValidationSchema,
};

export default taskValidations;
