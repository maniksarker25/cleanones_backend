import { Schema, model } from 'mongoose';
import { TTask } from './task.interface';

// Template only — no photo_url/is_uploaded here, see task.interface.ts.
const photoRequirementSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: null, trim: true },
        reference_image_url: { type: String, default: null, trim: true },
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
        required_photo_count: { type: Number, default: null },
        duration_minutes: { type: Number, required:true },
        days_of_week: { type: [String], default: undefined },
        days_of_month: { type: [Number], default: undefined },
        is_active: { type: Boolean, default: true },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

taskSchema.index({ room: 1, is_active: 1 });

export const Task = model<TTask>('Task', taskSchema);
