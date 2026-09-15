import { Schema, model } from 'mongoose';
import { IAssignedWorker, ICleaningPlan } from './cleaning_plan.interface';

const assignedWorkerSchema = new Schema<IAssignedWorker>(
    {
        worker: {
            type: Schema.Types.ObjectId,
            ref: 'Worker',
            required: true,
        },
        role: {
            type: String,
            enum: ['Team leader', 'Co-leader', 'Normal worker'],
            required: true,
        },
        assigned_with_conflict: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

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
        assigned_workers: {
            type: [assignedWorkerSchema] as unknown as typeof assignedWorkerSchema[],
            default: [],
        },
        date_time: {
            type: Date,
            required: true,
        },
        end_date: {
            type: Date,
            default: null,
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

cleaningPlanSchema.index({ 'assigned_workers.worker': 1, is_active: 1 });

export const CleaningPlan = model<ICleaningPlan>(
    'CleaningPlan',
    cleaningPlanSchema,
    'cleaning_plans'
);
