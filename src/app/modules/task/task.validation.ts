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

// Template only — a Task declares a POOL of possible photo titles plus how
// many of them (required_photo_count) get randomly required per occurrence.
// Upload state (photo_url/is_uploaded) is per-occurrence and lives on the
// Shift's own task-instance snapshot instead.
const photoRequirementSchema = z.object({
    title: z.string().min(1, 'Photo title is required').trim(),
});

const photoFieldsRefinement = (
    data: {
        is_photo_required?: boolean;
        photo_requirements?: { title: string }[];
        required_photo_count?: number;
    },
    ctx: z.RefinementCtx
) => {
    if (!data.is_photo_required) return;

    const poolSize = data.photo_requirements?.length ?? 0;
    if (poolSize === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
                'photo_requirements is required when is_photo_required is true',
            path: ['photo_requirements'],
        });
    }

    if (data.required_photo_count === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
                'required_photo_count is required when is_photo_required is true',
            path: ['required_photo_count'],
        });
    } else if (data.required_photo_count < 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'required_photo_count must be at least 1',
            path: ['required_photo_count'],
        });
    } else if (poolSize > 0 && data.required_photo_count > poolSize) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
                'required_photo_count cannot exceed the number of photo_requirements',
            path: ['required_photo_count'],
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
            photo_requirements: z.array(photoRequirementSchema).optional(),
            required_photo_count: z.coerce.number().int().positive().optional(),
            duration_minutes: z.coerce.number().positive().optional(),
            days_of_week: z.array(z.enum(WEEKDAYS)).optional(),
            days_of_month: z.array(z.number().min(1).max(31)).optional(),
            is_active: z.boolean().optional(),
        })
        .superRefine(frequencyFieldsRefinement)
        .superRefine(photoFieldsRefinement),
});

const updateTaskValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, 'Name cannot be empty').optional(),
            frequency_type: z.enum(['daily', 'weekly', 'monthly']).optional(),
            is_photo_required: z.boolean().optional(),
            photo_requirements: z.array(photoRequirementSchema).optional(),
            required_photo_count: z.coerce.number().int().positive().optional(),
            duration_minutes: z.coerce.number().positive().optional(),
            days_of_week: z.array(z.enum(WEEKDAYS)).optional(),
            days_of_month: z.array(z.number().min(1).max(31)).optional(),
            is_active: z.boolean().optional(),
        })
        .partial()
        .superRefine(frequencyFieldsRefinement)
        .superRefine(photoFieldsRefinement),
});

const taskValidations = {
    createTaskValidationSchema,
    updateTaskValidationSchema,
};

export default taskValidations;
