import { Schema, model } from 'mongoose';
import { TManager } from './manager.interface';

const managerSchema = new Schema<TManager>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
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
        address: {
            type: String,
            default: null,
        },
        profile_image: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const Manager = model<TManager>('Manager', managerSchema, 'managers');
