"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const registerAdminValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z
            .string({ required_error: 'Password is required' })
            .min(6, { message: 'Password must be 6 character' }),
        admin: zod_1.z.object({
            name: zod_1.z.string().min(1, { message: 'Name is required' }),
            email: zod_1.z.string().email({ message: 'Invalid email address' }),
            profileImage: zod_1.z.string().optional(),
            bankName: zod_1.z.string().optional(),
            accountName: zod_1.z.string().optional(),
            accountNumber: zod_1.z.number().nullable().optional(),
            branchCode: zod_1.z.number().nullable().optional(),
            status: zod_1.z.enum(['active', 'deactivate']).default('active'),
        }),
    }),
});
const createAdminProfileValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, { message: 'Name is required' }).optional(),
        email: zod_1.z
            .string()
            .email({ message: 'Invalid email address' })
            .toLowerCase()
            .optional(),
        address: zod_1.z.string().optional(),
        website: zod_1.z.string().optional(),
        password: zod_1.z.string({ required_error: 'Password is required' }),
        confirmPassword: zod_1.z.string({
            required_error: 'Confirm password is required',
        }),
    })
        .partial(),
});
const updateAdminProfileValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, { message: 'Name is required' }).optional(),
        email: zod_1.z
            .string()
            .email({ message: 'Invalid email address' })
            .toLowerCase()
            .optional(),
        address: zod_1.z.string().optional(),
        website: zod_1.z.string().optional(),
    })
        .partial(),
});
const getNearbyShopValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        latitude: zod_1.z.number({ required_error: 'Latitude is required' }),
        longitude: zod_1.z.number({ required_error: 'Longitude is required' }),
    }),
});
const addRatingValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        rating: zod_1.z
            .number({
            required_error: 'Rating is required',
            invalid_type_error: 'Rating must be a number',
        })
            .max(5, { message: 'Rating must be at most 5' }),
    }),
});
const AdminValidations = {
    registerAdminValidationSchema,
    updateAdminProfileValidationSchema,
    getNearbyShopValidationSchema,
    addRatingValidationSchema,
    createAdminProfileValidationSchema,
};
exports.default = AdminValidations;
