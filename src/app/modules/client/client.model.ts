import { Schema, model } from 'mongoose';
import { TClient } from './client.interface';

const clientSchema = new Schema<TClient>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        company_name: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

export const Client = model<TClient>('Client', clientSchema, 'clients');
