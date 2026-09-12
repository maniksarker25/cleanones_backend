import { z } from 'zod';

const registerAdminValidationSchema = z.object({
    body: z.object({
        password: z
            .string({ required_error: 'Password is required' })
            .min(6, { message: 'Password must be 6 character' }),
        admin: z.object({
            name: z.string().min(1, { message: 'Name is required' }),
            email: z.string().email({ message: 'Invalid email address' }),
            profileImage: z.string().optional(),
            bankName: z.string().optional(),
            accountName: z.string().optional(),
            accountNumber: z.number().nullable().optional(),
            branchCode: z.number().nullable().optional(),
            status: z.enum(['active', 'deactivate']).default('active'),
        }),
    }),
});

const createAdminProfileValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, { message: 'Name is required' }).optional(),
            email: z
                .string()
                .email({ message: 'Invalid email address' })
                .optional(),
            address: z.string().optional(),
            website: z.string().optional(),
            password: z.string({ required_error: 'Password is required' }),
            confirmPassword: z.string({
                required_error: 'Confirm password is required',
            }),
        })
        .partial(),
});
const updateAdminProfileValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, { message: 'Name is required' }).optional(),
            email: z
                .string()
                .email({ message: 'Invalid email address' })
                .optional(),
            address: z.string().optional(),
            website: z.string().optional(),
        })
        .partial(),
});

const getNearbyShopValidationSchema = z.object({
    body: z.object({
        latitude: z.number({ required_error: 'Latitude is required' }),
        longitude: z.number({ required_error: 'Longitude is required' }),
    }),
});

const addRatingValidationSchema = z.object({
    body: z.object({
        rating: z
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

export default AdminValidations;
