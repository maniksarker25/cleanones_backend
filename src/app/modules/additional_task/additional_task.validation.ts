import { z } from 'zod';
import { ADDITIONAL_TASK_STATUS } from './additional_task.interface';

const queryBoolean = z
    .enum(['true', 'false'], {
        errorMap: () => ({ message: 'Must be the string "true" or "false"' }),
    })
    .transform((value) => value === 'true')
    .optional();
export const additionalTaskListQuerySchema = z.object({
    planId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid planId').optional(),
    // Manager-only — narrows to one client's plans when planId isn't given.
    // Ignored for a client requester, who is always scoped to themselves.
    client: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid client ID').optional(),
    page: z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0).optional(),
    searchTerm: z.string().optional(),
    sort: z.string().regex(/^-?(name|description|duration_minutes|date_time|createdAt|updatedAt|status|is_completed)$/).optional(),
    status: z.enum(ADDITIONAL_TASK_STATUS).optional(),
    is_completed: queryBoolean,
    is_photo_required: queryBoolean,
});

const photoRequirementSchema = z.object({
    title: z.string().min(1, 'Photo title is required').trim(),
    description: z.string().trim().optional(),
    reference_image_url: z.string().trim().optional(),
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
        duration_minutes: z.number().min(0).nullable().optional(),
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
            duration_minutes: z.number().min(0).nullable().optional(),
            is_photo_required: z.boolean().optional(),
            photo_requirements: z.array(photoRequirementSchema).optional(),
            date_time: z.coerce.date().optional(),
            is_completed: z.boolean().optional(),
        })
        .partial(),
});

const approveAdditionalTaskValidationSchema = z.object({
    body: z
        .object({
            status: z.enum(['Approved', 'Rejected'], {
                required_error: 'status is required',
                invalid_type_error: "status must be 'Approved' or 'Rejected'",
            }),
            reject_reason: z.string().trim().min(1).optional(),
            // Manager can adjust these while approving — e.g. the client's
            // proposed duration needs correcting, or the manager wants to
            // set/change which photos are required — without a separate
            // update-additional-task call first. Ignored when rejecting.
            duration_minutes: z.number().min(0).nullable().optional(),
            photo_requirements: z.array(photoRequirementSchema).optional(),
        })
        .refine(
            (data) => data.status !== 'Rejected' || !!data.reject_reason,
            {
                message: 'reject_reason is required when status is Rejected',
                path: ['reject_reason'],
            }
        ),
});

const additionalTaskValidations = {
    createAdditionalTaskValidationSchema,
    updateAdditionalTaskValidationSchema,
    approveAdditionalTaskValidationSchema,
};

export default additionalTaskValidations;
