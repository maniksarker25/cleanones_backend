import { Schema, model } from 'mongoose';
import { TInvoice } from './invoice.interface';

const invoiceSchema = new Schema<TInvoice>(
    {
        manager: {
            type: Schema.Types.ObjectId,
            ref: 'Manager',
            required: true,
            index: true,
        },
        worker: {
            type: Schema.Types.ObjectId,
            ref: 'Worker',
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        payment_method: {
            type: String,
            required: true,
        },
        transaction_id: {
            type: String,
            default: null,
        },
        notes: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

export const Invoice = model<TInvoice>('Invoice', invoiceSchema, 'invoices');
