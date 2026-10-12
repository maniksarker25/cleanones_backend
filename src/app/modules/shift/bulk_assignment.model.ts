import { Schema, Types, model } from 'mongoose';

// One record per confirmed bulk-assign: remembers the last date it covers so
// the cron can remind the manager to renew it before it runs out.
export interface IBulkAssignment {
    cleaning_plan: Types.ObjectId;
    worker: Types.ObjectId;
    manager: Types.ObjectId;
    from: Date;
    // Last date that was actually assigned (not the requested range end).
    to: Date;
    reminder_7d_sent_at?: Date | null;
    reminder_4d_sent_at?: Date | null;
    // Set when a later bulk-assign for the same plan+worker starts after `to`.
    renewed_by?: Types.ObjectId | null;
}

const bulkAssignmentSchema = new Schema<IBulkAssignment>(
    {
        cleaning_plan: { type: Schema.Types.ObjectId, ref: 'CleaningPlan', required: true },
        worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
        manager: { type: Schema.Types.ObjectId, ref: 'Manager', required: true },
        from: { type: Date, required: true },
        to: { type: Date, required: true },
        reminder_7d_sent_at: { type: Date, default: null },
        reminder_4d_sent_at: { type: Date, default: null },
        renewed_by: { type: Schema.Types.ObjectId, ref: 'BulkAssignment', default: null },
    },
    { timestamps: true }
);

bulkAssignmentSchema.index({ renewed_by: 1, to: 1 });
bulkAssignmentSchema.index({ cleaning_plan: 1, worker: 1, to: -1 });

export const BulkAssignment = model<IBulkAssignment>('BulkAssignment', bulkAssignmentSchema);
