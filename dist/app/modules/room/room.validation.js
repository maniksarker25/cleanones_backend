"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const createRoomValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        location: zod_1.z.string({ required_error: 'Location is required' }),
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
        room_type: zod_1.z.string({ required_error: 'Room type is required' }).min(1),
        cleaning_type: zod_1.z
            .string({ required_error: 'Cleaning type is required' })
            .min(1),
        floor: zod_1.z.coerce.number().optional(),
        is_active: zod_1.z.boolean().optional(),
    }),
});
const updateRoomValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, 'Name cannot be empty').optional(),
        room_type: zod_1.z.string().min(1, 'Room type cannot be empty').optional(),
        cleaning_type: zod_1.z
            .string()
            .min(1, 'Cleaning type cannot be empty')
            .optional(),
        floor: zod_1.z.coerce.number().optional(),
        is_active: zod_1.z.boolean().optional(),
    })
        .partial(),
});
const roomValidations = {
    createRoomValidationSchema,
    updateRoomValidationSchema,
};
exports.default = roomValidations;
