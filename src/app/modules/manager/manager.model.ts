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
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

export const Manager = model<TManager>('Manager', managerSchema, 'managers');
