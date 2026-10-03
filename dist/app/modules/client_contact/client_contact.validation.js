"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const contactBody = zod_1.z
    .object({
    client: zod_1.z.string({ required_error: 'Client is required' }).regex(/^[a-fA-F0-9]{24}$/, 'Invalid client ID'),
    name: zod_1.z.string().trim().min(1, 'Name is required'),
    role: zod_1.z.string().trim().min(1, 'Role is required'),
    phone: zod_1.z.string().trim().min(1, 'Phone is required'),
    email: zod_1.z
        .string({ required_error: 'Email is required' })
        .trim()
        .email('Invalid email address')
        .toLowerCase(),
})
    .strict();
const createClientContactValidationSchema = zod_1.z.object({ body: contactBody });
const updateClientContactValidationSchema = zod_1.z.object({
    body: contactBody.partial().refine((body) => Object.keys(body).length > 0, {
        message: 'At least one field is required',
    }),
});
exports.default = {
    createClientContactValidationSchema,
    updateClientContactValidationSchema,
};
