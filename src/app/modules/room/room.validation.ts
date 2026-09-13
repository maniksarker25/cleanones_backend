import { z } from 'zod';

const createRoomValidationSchema = z.object({
    body: z.object({
        location: z.string({ required_error: 'Location is required' }),
        name: z.string({ required_error: 'Name is required' }).min(1),
        room_type: z.string({ required_error: 'Room type is required' }).min(1),
        cleaning_type: z
            .string({ required_error: 'Cleaning type is required' })
            .min(1),
        floor: z.coerce.number().optional(),
        is_active: z.boolean().optional(),
    }),
});

const updateRoomValidationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, 'Name cannot be empty').optional(),
            room_type: z.string().min(1, 'Room type cannot be empty').optional(),
            cleaning_type: z
                .string()
                .min(1, 'Cleaning type cannot be empty')
                .optional(),
            floor: z.coerce.number().optional(),
            is_active: z.boolean().optional(),
        })
        .partial(),
});

const roomValidations = {
    createRoomValidationSchema,
    updateRoomValidationSchema,
};

export default roomValidations;
