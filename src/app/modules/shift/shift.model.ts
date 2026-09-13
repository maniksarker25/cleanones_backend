import { Schema, model } from 'mongoose';
import { IShift } from './shift.interface';

const assignedWorkerSchema = new Schema(
    {
        worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
        role: {
            type: String,
            enum: ['Team leader', 'Co-leader', 'Normal worker'],
            required: true,
        },
        assigned_with_conflict: { type: Boolean, default: false },
    },
    { _id: false }
);

const shiftSchema = new Schema<IShift>(
    {
        cleaning_plan: {
            type: Schema.Types.ObjectId,
            ref: 'CleaningPlan',
            required: true,
            index: true,
        },
        date: {
            type: Date,
            required: true,
        },
        date_time: {
            type: Date,
            required: true,
        },
        rooms: {
            type: [Schema.Types.ObjectId],
            ref: 'Room',
            default: [],
        },
        duration_minutes: {
            type: Number,
            default: 0,
            min: 0,
        },
        assigned_workers: {
            type: [assignedWorkerSchema],
            default: [],
        },
        is_worker_overridden: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
            default: 'upcoming',
        },
        last_updated_by: {
            type: Schema.Types.ObjectId,
            ref: 'Manager',
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// The core idempotency guarantee: a plan can have at most one shift per
// calendar day, regardless of whether it was created by a manager's edit or
// by the daily materialization cron — whichever writes first wins, and the
// other side's insert fails with a duplicate-key error it can recover from.
shiftSchema.index({ cleaning_plan: 1, date: 1 }, { unique: true });
shiftSchema.index({ 'assigned_workers.worker': 1, date: 1 });

export const Shift = model<IShift>('Shift', shiftSchema, 'shifts');
