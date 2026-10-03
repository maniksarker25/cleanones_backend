"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const createCleaningPlanValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ required_error: 'Title is required' }).min(1).trim(),
        description: zod_1.z
            .string({ required_error: 'Description is required' })
            .min(1)
            .trim(),
        client: zod_1.z.string({ required_error: 'Client is required' }),
        location: zod_1.z.string({ required_error: 'Location is required' }),
        rooms: zod_1.z.array(zod_1.z.string()).optional(),
        tasks: zod_1.z.array(zod_1.z.string()).optional(),
        note: zod_1.z.string().nullable().optional(),
        status: zod_1.z.enum(['active', 'inactive', 'completed']).optional(),
    }),
});
const updateCleaningPlanValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        title: zod_1.z.string().min(1).trim().optional(),
        description: zod_1.z.string().min(1).trim().optional(),
        rooms: zod_1.z.array(zod_1.z.string()).optional(),
        tasks: zod_1.z.array(zod_1.z.string()).optional(),
        note: zod_1.z.string().nullable().optional(),
        status: zod_1.z.enum(['active', 'inactive', 'completed']).optional(),
    })
        .partial(),
});
const cleaningPlanValidations = {
    createCleaningPlanValidationSchema,
    updateCleaningPlanValidationSchema,
};
exports.default = cleaningPlanValidations;
