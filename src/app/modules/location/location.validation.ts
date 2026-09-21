import { z } from 'zod';

const coordinatesSchema = z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
});

const createLocationValidationSchema = z.object({
    body: z.object({
        client: z.string({ required_error: 'Client is required' }),
        name: z.string({ required_error: 'Name is required' }).min(1),
        address: z.string({ required_error: 'Address is required' }).min(1),
        description: z.string().optional(),
        type: z.string({ required_error: 'Type is required' }).min(1),
        is_active: z.boolean().optional(),
        location: coordinatesSchema.optional(),
    }),
});

const updateLocationValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, 'Name cannot be empty').optional(),
            address: z.string().min(1, 'Address cannot be empty').optional(),
            description: z.string().optional(),
            type: z.string().min(1, 'Type cannot be empty').optional(),
            is_active: z.boolean().optional(),
            location: coordinatesSchema.optional(),
        })
        .partial(),
});

const locationValidations = {
    createLocationValidationSchema,
    updateLocationValidationSchema,
};

export default locationValidations;
