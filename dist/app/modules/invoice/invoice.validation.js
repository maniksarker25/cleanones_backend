"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const createInvoiceValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        worker: zod_1.z
            .string({ required_error: 'Worker is required' })
            .regex(/^[a-fA-F0-9]{24}$/, 'Invalid worker ID'),
        amount: zod_1.z.coerce
            .number({ required_error: 'Amount is required' })
            .positive('Amount must be greater than 0'),
        payment_method: zod_1.z
            .string({ required_error: 'Payment method is required' })
            .min(1),
        transaction_id: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
const invoiceValidations = {
    createInvoiceValidationSchema,
};
exports.default = invoiceValidations;
