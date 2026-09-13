import { z } from 'zod';

const createInvoiceValidationSchema = z.object({
    body: z.object({
        worker: z
            .string({ required_error: 'Worker is required' })
            .regex(/^[a-fA-F0-9]{24}$/, 'Invalid worker ID'),
        amount: z.coerce
            .number({ required_error: 'Amount is required' })
            .positive('Amount must be greater than 0'),
        payment_method: z
            .string({ required_error: 'Payment method is required' })
            .min(1),
        transaction_id: z.string().optional(),
        notes: z.string().optional(),
    }),
});

const invoiceValidations = {
    createInvoiceValidationSchema,
};

export default invoiceValidations;
