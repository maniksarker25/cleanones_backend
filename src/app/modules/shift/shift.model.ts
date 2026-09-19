import { Schema, model } from 'mongoose';
import { IShift } from './shift.interface';

const photoRequirementSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: null, trim: true },
        reference_image_url: { type: String, default: null, trim: true },
        photo_url: { type: String, default: null },
        is_uploaded: { type: Boolean, default: false },
    },
    { _id: false }
);

const geoPointSchema = new Schema(
    {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
    },
    { _id: false }
);

const shiftLocationSchema = new Schema(
    {
        location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
        name: { type: String, required: true },
        coordinates: { type: geoPointSchema, default: null },
    },
    { _id: false }
);

const shiftRoomSchema = new Schema(
    {
        room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
        name: { type: String, required: true },
        room_type: { type: String, required: true },
    },
    { _id: false }
);

const shiftTaskSchema = new Schema(
    {
        // Refs Task for source 'plan_task', AdditionalTask for source
        // 'additional_task' — no single `ref` fits both, so it's left
        // unset; nothing here is ever populated (see IShiftTask).
        task: { type: Schema.Types.ObjectId, required: true },
        // Not set for 'additional_task' entries — those aren't scoped to a room.
        room: { type: Schema.Types.ObjectId, ref: 'Room', required: false, default: null },
        name: { type: String, required: true },
        duration_minutes: { type: Number, default: 0, min: 0 },
        is_photo_required: { type: Boolean, default: false },
        photo_requirements: { type: [photoRequirementSchema], default: [] },
        is_completed: { type: Boolean, default: false },
        completed_at: { type: Date, default: null },
        source: {
            type: String,
            enum: ['plan_task', 'additional_task'],
            default: 'plan_task',
        },
    },
    { _id: false }
);

const shiftAssignedWorkerSchema = new Schema(
    {
        worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
        name: { type: String, required: true },
        role: {
            type: String,
            enum: ['Team leader', 'Co-leader', 'Normal worker'],
            required: true,
        },
        assigned_with_conflict: { type: Boolean, default: false },
        check_in_at: { type: Date, default: null },
        check_in_coordinates: { type: [Number], default: null },
        check_out_at: { type: Date, default: null },
        check_out_coordinates: { type: [Number], default: null },
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
        end_time: {
            type: Date,
            required: true,
        },
        location: {
            type: shiftLocationSchema,
            required: true,
        },
        rooms: {
            type: [shiftRoomSchema],
            default: [],
        },
        tasks: {
            type: [shiftTaskSchema],
            default: [],
        },
        duration_minutes: {
            type: Number,
            default: 0,
            min: 0,
        },
        assigned_workers: {
            type: [shiftAssignedWorkerSchema],
            default: [],
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
// Supports the manager-facing "today's shifts" queries (today-live-shift-meta,
// today-live-shifts), which filter by date alone or date + location — this
// compound index covers both via the standard prefix rule, since none of the
// existing indexes above start with a bare `date`.
shiftSchema.index({ date: 1, 'location.location': 1 });

export const Shift = model<IShift>('Shift', shiftSchema, 'shifts');
