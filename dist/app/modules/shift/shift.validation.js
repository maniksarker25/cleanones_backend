"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const assignedWorkerSchema = zod_1.z.object({
    worker: zod_1.z.string({ required_error: 'Worker ID is required' }),
    role: zod_1.z.enum(['Team leader', 'Co-leader', 'Normal worker'], {
        required_error: 'Worker role is required',
    }),
});
const assignWorkersValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        assigned_workers: zod_1.z.array(assignedWorkerSchema),
        start_time: zod_1.z.coerce.date({ required_error: 'start_time is required' }),
        end_time: zod_1.z.coerce.date({ required_error: 'end_time is required' }),
        force: zod_1.z.coerce.boolean().optional(),
    })
        .refine((data) => data.end_time > data.start_time, {
        message: 'end_time must be after start_time',
        path: ['end_time'],
    }),
});
const updateStatusValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['upcoming', 'in_progress', 'completed', 'cancelled'], {
            required_error: 'Status is required',
        }),
    }),
});
const uploadTaskPhotoValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ required_error: 'title is required' }).min(1).trim(),
        photo_url: zod_1.z
            .string({ required_error: 'photo_url is required' })
            .min(1)
            .trim(),
    }),
});
const photoVerdictValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ required_error: 'title is required' }).min(1).trim(),
        verdict: zod_1.z.enum(['approved', 'rejected'], {
            required_error: 'verdict is required',
        }),
        note: zod_1.z.string().trim().optional(),
    }),
});
const dateOnlyString = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD').refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Date must be a valid calendar date');
// MAX_BULK_ASSIGN_RANGE_DAYS in shift.services.ts — kept in sync manually
// since a Zod schema can't import a service-layer constant without creating
// a validation -> service dependency the rest of this file avoids.
const MAX_BULK_ASSIGN_DATES = 60;
const bulkAssignValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        worker: zod_1.z.string({ required_error: 'Worker ID is required' }),
        role: zod_1.z.enum(['Team leader', 'Co-leader', 'Normal worker'], {
            required_error: 'Worker role is required',
        }),
        dates: zod_1.z
            .array(dateOnlyString)
            .min(1, 'At least one date is required')
            .max(MAX_BULK_ASSIGN_DATES, `No more than ${MAX_BULK_ASSIGN_DATES} dates per request`),
        start_time: zod_1.z.coerce.date({ required_error: 'start_time is required' }),
        end_time: zod_1.z.coerce.date({ required_error: 'end_time is required' }),
        force: zod_1.z.coerce.boolean().optional(),
    })
        .refine((data) => data.end_time > data.start_time, {
        message: 'end_time must be after start_time',
        path: ['end_time'],
    }),
});
const bulkAssignPreviewQuery = zod_1.z
    .object({
    worker: zod_1.z.string({ required_error: 'worker is required' }),
    from: dateOnlyString,
    to: dateOnlyString,
})
    .strict();
const checkInOutValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        latitude: zod_1.z.coerce.number({ required_error: 'latitude is required' }).min(-90).max(90),
        longitude: zod_1.z.coerce.number({ required_error: 'longitude is required' }).min(-180).max(180),
    }),
});
const managerReportQuery = zod_1.z
    .object({
    period: zod_1.z.enum(['week', 'month', 'quarter', 'year'], {
        required_error: 'period is required',
    }),
})
    .strict();
const shiftValidations = {
    workerShiftsQuery: zod_1.z.object({
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD').refine((value) => {
            const date = new Date(value);
            return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
        }, 'Date must be a valid calendar date'),
    }).strict(),
    managerReportQuery,
    assignWorkersValidationSchema,
    bulkAssignValidationSchema,
    bulkAssignPreviewQuery,
    updateStatusValidationSchema,
    uploadTaskPhotoValidationSchema,
    photoVerdictValidationSchema,
    checkInOutValidationSchema,
};
exports.default = shiftValidations;
