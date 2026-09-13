import { Schema, model } from 'mongoose';
import { TTask } from './task.interface';

const photoRequirementSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        photo_url: { type: String, default: null },
        is_uploaded: { type: Boolean, default: false },
    },
    { _id: false }
);

const taskSchema = new Schema<TTask>(
    {
        client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        location: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
        room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
        last_updated_by: { type: Schema.Types.ObjectId, ref: 'Manager', default: null },
        name: { type: String, required: true },
        frequency_type: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
        is_photo_required: { type: Boolean, default: false },
        photo_requirements: { type: [photoRequirementSchema], default: [] },
        duration_minutes: { type: Number, required:true },
        days_of_week: { type: [String], default: undefined },
        days_of_month: { type: [Number], default: undefined },
        is_active: { type: Boolean, default: true },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

taskSchema.index({ room: 1, is_active: 1 });

export const Task = model<TTask>('Task', taskSchema);
