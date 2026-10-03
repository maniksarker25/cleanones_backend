"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.additionalTaskListQuerySchema = void 0;
const zod_1 = require("zod");
const additional_task_interface_1 = require("./additional_task.interface");
const queryBoolean = zod_1.z
    .enum(['true', 'false'], {
    errorMap: () => ({ message: 'Must be the string "true" or "false"' }),
})
    .transform((value) => value === 'true')
    .optional();
exports.additionalTaskListQuerySchema = zod_1.z.object({
    planId: zod_1.z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid planId').optional(),
    // Manager-only — narrows to one client's plans when planId isn't given.
    // Ignored for a client requester, who is always scoped to themselves.
    client: zod_1.z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid client ID').optional(),
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0).optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0).optional(),
    searchTerm: zod_1.z.string().optional(),
    sort: zod_1.z.string().regex(/^-?(name|description|duration_minutes|date_time|createdAt|updatedAt|status|is_completed)$/).optional(),
    status: zod_1.z.enum(additional_task_interface_1.ADDITIONAL_TASK_STATUS).optional(),
    is_completed: queryBoolean,
    is_photo_required: queryBoolean,
});
const photoRequirementSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Photo title is required').trim(),
    description: zod_1.z.string().trim().optional(),
    reference_image_url: zod_1.z.string().trim().optional(),
    photo_url: zod_1.z.string().nullable().optional(),
    is_uploaded: zod_1.z.boolean().optional(),
});
const createAdditionalTaskValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        cleaning_plan_id: zod_1.z.string({
            required_error: 'Cleaning plan ID is required',
        }),
        name: zod_1.z
            .string({ required_error: 'Name is required' })
            .min(1)
            .trim(),
        description: zod_1.z.string().trim().optional(),
        duration_minutes: zod_1.z.number().min(0).nullable().optional(),
        is_photo_required: zod_1.z.boolean().optional(),
        photo_requirements: zod_1.z.array(photoRequirementSchema).optional(),
        date_time: zod_1.z.coerce.date({
            required_error: 'Date and time is required',
        }),
    }),
});
const updateAdditionalTaskValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1).trim().optional(),
        description: zod_1.z.string().trim().optional(),
        duration_minutes: zod_1.z.number().min(0).nullable().optional(),
        is_photo_required: zod_1.z.boolean().optional(),
        photo_requirements: zod_1.z.array(photoRequirementSchema).optional(),
        date_time: zod_1.z.coerce.date().optional(),
        is_completed: zod_1.z.boolean().optional(),
    })
        .partial(),
});
const approveAdditionalTaskValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        status: zod_1.z.enum(['Approved', 'Rejected'], {
            required_error: 'status is required',
            invalid_type_error: "status must be 'Approved' or 'Rejected'",
        }),
        reject_reason: zod_1.z.string().trim().min(1).optional(),
        // Manager can adjust these while approving — e.g. the client's
        // proposed duration needs correcting, or the manager wants to
        // set/change which photos are required — without a separate
        // update-additional-task call first. Ignored when rejecting.
        duration_minutes: zod_1.z.number().min(0).nullable().optional(),
        photo_requirements: zod_1.z.array(photoRequirementSchema).optional(),
    })
        .refine((data) => data.status !== 'Rejected' || !!data.reject_reason, {
        message: 'reject_reason is required when status is Rejected',
        path: ['reject_reason'],
    }),
});
const additionalTaskValidations = {
    createAdditionalTaskValidationSchema,
    updateAdditionalTaskValidationSchema,
    approveAdditionalTaskValidationSchema,
};
exports.default = additionalTaskValidations;
