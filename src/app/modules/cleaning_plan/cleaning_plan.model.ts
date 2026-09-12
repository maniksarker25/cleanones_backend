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
        start_date: {
            type: Date,
            required: true,
        },
        start_time: {
            type: String,
            required: true,
            trim: true,
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
        additional_tasks: {
            type: [Schema.Types.ObjectId],
            ref: 'AdditionalTask',
            default: [],
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        versionKey: false,
    }
);

export const CleaningPlan = model<ICleaningPlan>(
    'CleaningPlan',
    cleaningPlanSchema,
    'cleaning_plans'
);
