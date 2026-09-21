import { z } from 'zod';
import { CONTRACT_STATUS } from './client.interface';

const createClientValidationSchema = z.object({
    body: z.object({
        name: z.string({ required_error: 'Name is required' }).min(1),
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase(),
        phone: z.string({ required_error: 'Phone number is required' }),
        company_name: z.string().optional(),
        profile_image: z.string().optional(),
        licence_expiration_date: z.coerce.date().optional(),
        contract_status: z
            .enum(CONTRACT_STATUS as unknown as [string, ...string[]])
            .optional(),
        password: z
            .string({ required_error: 'Password is required' })
            .min(6, 'Password must be at least 6 characters'),
        confirmPassword: z.string({
            required_error: 'Confirm password is required',
        }),
    }),
});

const updateClientValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, 'Name cannot be empty').optional(),
            email: z.string().email('Invalid email format').toLowerCase().optional(),
            phone: z.string().optional(),
            company_name: z.string().optional(),
            profile_image: z.string().optional(),
            licence_expiration_date: z.coerce.date().optional(),
            contract_status: z
                .enum(CONTRACT_STATUS as unknown as [string, ...string[]])
                .optional(),
        })
        .partial(),
});

const clientValidations = {
    createClientValidationSchema,
    updateClientValidationSchema,
};

export default clientValidations;
