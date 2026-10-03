"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const coordinatesSchema = zod_1.z.object({
    type: zod_1.z.literal('Point').default('Point'),
    coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
});
const createLocationValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        client: zod_1.z.string({ required_error: 'Client is required' }),
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
        address: zod_1.z.string({ required_error: 'Address is required' }).min(1),
        description: zod_1.z.string().optional(),
        type: zod_1.z.string({ required_error: 'Type is required' }).min(1),
        is_active: zod_1.z.boolean().optional(),
        location: coordinatesSchema.optional(),
    }),
});
const updateLocationValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, 'Name cannot be empty').optional(),
        address: zod_1.z.string().min(1, 'Address cannot be empty').optional(),
        description: zod_1.z.string().optional(),
        type: zod_1.z.string().min(1, 'Type cannot be empty').optional(),
        is_active: zod_1.z.boolean().optional(),
        location: coordinatesSchema.optional(),
    })
        .partial(),
});
const locationValidations = {
    createLocationValidationSchema,
    updateLocationValidationSchema,
};
exports.default = locationValidations;
