"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const client_interface_1 = require("./client.interface");
const createClientValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase(),
        phone: zod_1.z.string({ required_error: 'Phone number is required' }),
        company_name: zod_1.z.string().optional(),
        profile_image: zod_1.z.string().optional(),
        licence_expiration_date: zod_1.z.coerce.date().optional(),
        contract_status: zod_1.z
            .enum(client_interface_1.CONTRACT_STATUS)
            .optional(),
        password: zod_1.z
            .string({ required_error: 'Password is required' })
            .min(6, 'Password must be at least 6 characters'),
        confirmPassword: zod_1.z.string({
            required_error: 'Confirm password is required',
        }),
    }),
});
const updateClientValidationSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, 'Name cannot be empty').optional(),
        email: zod_1.z.string().email('Invalid email format').toLowerCase().optional(),
        phone: zod_1.z.string().optional(),
        company_name: zod_1.z.string().optional(),
        profile_image: zod_1.z.string().optional(),
        licence_expiration_date: zod_1.z.coerce.date().optional(),
        contract_status: zod_1.z
            .enum(client_interface_1.CONTRACT_STATUS)
            .optional(),
    })
        .partial(),
});
const clientValidations = {
    createClientValidationSchema,
    updateClientValidationSchema,
};
exports.default = clientValidations;
