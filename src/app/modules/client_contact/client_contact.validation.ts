import { z } from 'zod';

const contactBody = z
    .object({
        client: z.string({ required_error: 'Client is required' }).regex(/^[a-fA-F0-9]{24}$/, 'Invalid client ID'),
        name: z.string().trim().min(1, 'Name is required'),
        role: z.string().trim().min(1, 'Role is required'),
        phone: z.string().trim().min(1, 'Phone is required'),
        email: z
            .string({ required_error: 'Email is required' })
            .trim()
            .email('Invalid email address')
            .toLowerCase(),
    })
    .strict();

const createClientContactValidationSchema = z.object({ body: contactBody });
const updateClientContactValidationSchema = z.object({
    body: contactBody.partial().refine((body) => Object.keys(body).length > 0, {
        message: 'At least one field is required',
    }),
});

export default {
    createClientContactValidationSchema,
    updateClientContactValidationSchema,
};
