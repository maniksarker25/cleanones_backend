import { Schema, model } from 'mongoose';
import { ICleaningPlan } from './cleaning_plan.interface';

const cleaningPlanSchema = new Schema<ICleaningPlan>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
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
        client: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        location: {
            type: Schema.Types.ObjectId,
            ref: 'Location',
            required: true,
        },
        rooms: {
            type: [Schema.Types.ObjectId],
            ref: 'Room',
            default: [],
        },
        max_estimated_duration: {
            type: Number,
            default: 0,
            min: 0,
        },
        note: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'completed'],
            default: 'active',
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const CleaningPlan = model<ICleaningPlan>(
    'CleaningPlan',
    cleaningPlanSchema,
    'cleaning_plans'
);
