import { Schema, model } from 'mongoose';
import { CONTRACT_STATUS, TClient } from './client.interface';

const clientSchema = new Schema<TClient>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        manager: {
            type: Schema.Types.ObjectId,
            ref: 'Manager',
            required: true,
            index: true,
        },
        last_updated_by: {
            type: Schema.Types.ObjectId,
            ref: 'Manager',
            default: null,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        company_name: {
            type: String,
            default: null,
        },
        licence_expiration_date: {
            type: Date,
            default: null,
        },
        contract_status: {
            type: String,
            enum: CONTRACT_STATUS,
            default: 'Pending',
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const Client = model<TClient>('Client', clientSchema, 'clients');
