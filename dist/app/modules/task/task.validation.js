"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const task_interface_1 = require("./task.interface");
const frequencyFieldsRefinement = (data, ctx) => {
    if (data.frequency_type === 'weekly' &&
        (!data.days_of_week || data.days_of_week.length === 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'days_of_week is required for weekly tasks',
            path: ['days_of_week'],
        });
    }
    if (data.frequency_type === 'monthly' &&
        (!data.days_of_month || data.days_of_month.length === 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'days_of_month is required for monthly tasks',
            path: ['days_of_month'],
        });
    }
};
// Template only — a Task declares a POOL of possible photo titles plus how
// many of them (required_photo_count) get randomly required per occurrence.
// Upload state (photo_url/is_uploaded) is per-occurrence and lives on the
// Shift's own task-instance snapshot instead.
const photoRequirementSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Photo title is required').trim(),
    description: zod_1.z.string().trim().optional(),
    reference_image_url: zod_1.z.string().trim().optional(),
});
const photoFieldsRefinement = (data, ctx) => {
    var _a, _b;
    if (!data.is_photo_required)
        return;
    const poolSize = (_b = (_a = data.photo_requirements) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    if (poolSize === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'photo_requirements is required when is_photo_required is true',
            path: ['photo_requirements'],
        });
    }
    if (data.required_photo_count === undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'required_photo_count is required when is_photo_required is true',
            path: ['required_photo_count'],
        });
    }
    else if (data.required_photo_count < 1) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'required_photo_count must be at least 1',
            path: ['required_photo_count'],
        });
    }
    else if (poolSize > 0 && data.required_photo_count > poolSize) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'required_photo_count cannot exceed the number of photo_requirements',
            path: ['required_photo_count'],
        });
    }
};
const createTaskValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        room: zod_1.z.string({ required_error: 'Room is required' }),
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
        frequency_type: zod_1.z.enum(['daily', 'weekly', 'monthly'], {
            required_error: 'Frequency type is required',
        }),
        is_photo_required: zod_1.z.boolean().optional(),
        photo_requirements: zod_1.z.array(photoRequirementSchema).optional(),
        required_photo_count: zod_1.z.coerce.number().int().positive().optional(),
        duration_minutes: zod_1.z.coerce.number().positive().optional(),
        days_of_week: zod_1.z.array(zod_1.z.enum(task_interface_1.WEEKDAYS)).optional(),
        days_of_month: zod_1.z.array(zod_1.z.number().min(1).max(31)).optional(),
        is_active: zod_1.z.boolean().optional(),
    })
        .superRefine(frequencyFieldsRefinement)
        .superRefine(photoFieldsRefinement),
});
const updateTaskValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, 'Name cannot be empty').optional(),
        frequency_type: zod_1.z.enum(['daily', 'weekly', 'monthly']).optional(),
        is_photo_required: zod_1.z.boolean().optional(),
        photo_requirements: zod_1.z.array(photoRequirementSchema).optional(),
        required_photo_count: zod_1.z.coerce.number().int().positive().optional(),
        duration_minutes: zod_1.z.coerce.number().positive().optional(),
        days_of_week: zod_1.z.array(zod_1.z.enum(task_interface_1.WEEKDAYS)).optional(),
        days_of_month: zod_1.z.array(zod_1.z.number().min(1).max(31)).optional(),
        is_active: zod_1.z.boolean().optional(),
        // Confirms a recurrence change that would cancel already-staffed
        // future shifts — see reconcileFutureShiftsForTaskChange. Without
        // it, such a change is rejected with a 409 listing what's affected.
        force: zod_1.z.coerce.boolean().optional(),
    })
        .partial()
        .superRefine(frequencyFieldsRefinement)
        .superRefine(photoFieldsRefinement),
});
const taskValidations = {
    createTaskValidationSchema,
    updateTaskValidationSchema,
};
exports.default = taskValidations;
