import { z } from 'zod';

const createCompanyValidationSchema = z.object({
    body: z
        .object({
            name: z.string({ required_error: 'Name is required' }).trim().min(1),
            email: z
                .string({ required_error: 'Email is required' })
                .trim()
                .email(),
            phone: z.string({ required_error: 'Phone is required' }).trim().min(1),
            company_name: z
                .string({ required_error: 'Company name is required' })
                .trim()
                .min(1),
            address: z.string().trim().optional(),
            website: z.string().trim().optional(),
            password: z
                .string({ required_error: 'Password is required' })
                .min(8, 'Password must be at least 8 characters'),
            confirmPassword: z.string({
                required_error: 'Confirm password is required',
            }),
        })
        .refine((body) => body.password === body.confirmPassword, {
            message: 'Password and confirm password do not match',
            path: ['confirmPassword'],
        }),
});

const updateCompanyValidationSchema = z.object({
    body: z
        .object({
            name: z.string().trim().min(1).optional(),
            phone: z.string().trim().min(1).optional(),
            company_name: z.string().trim().min(1).optional(),
            address: z.string().trim().optional(),
            website: z.string().trim().optional(),
        })
        .strict(),
});

const companyValidations = {
    createCompanyValidationSchema,
    updateCompanyValidationSchema,
};

export default companyValidations;
