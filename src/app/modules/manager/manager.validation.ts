import { z } from 'zod';

const createManagerBody = z.object({
    name: z.string({ required_error: 'Name is required' }).trim().min(1),
    email: z.string({ required_error: 'Email is required' }).trim().email(),
    phone: z.string({ required_error: 'Phone is required' }).trim().min(1),
    address: z.string().trim().optional(),
    password: z
        .string({ required_error: 'Password is required' })
        .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string({
        required_error: 'Confirm password is required',
    }),
});

const createManagerValidationSchema = z.object({
    body: createManagerBody.refine(
        (body) => body.password === body.confirmPassword,
        {
            message: 'Password and confirm password do not match',
            path: ['confirmPassword'],
        }
    ),
});

const createManagerForCompanyValidationSchema = z.object({
    body: createManagerBody
        .extend({
            company: z.string({ required_error: 'Company is required' }),
        })
        .refine((body) => body.password === body.confirmPassword, {
            message: 'Password and confirm password do not match',
            path: ['confirmPassword'],
        }),
});

const updateManagerValidationSchema = z.object({
    body: z
        .object({
            name: z.string().trim().min(1).optional(),
            phone: z.string().trim().min(1).optional(),
            address: z.string().trim().optional(),
        })
        .strict(),
});

const managerValidations = {
    createManagerValidationSchema,
    createManagerForCompanyValidationSchema,
    updateManagerValidationSchema,
};

export default managerValidations;
