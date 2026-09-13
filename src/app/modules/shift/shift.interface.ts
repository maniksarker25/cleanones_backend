import { Types } from 'mongoose';
import { IAssignedWorker } from '../cleaning_plan/cleaning_plan.interface';

export type ShiftStatus =
    | 'upcoming'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface IShift {
    cleaning_plan: Types.ObjectId;
    // Calendar day only (normalized to UTC midnight) — identifies the occurrence.
    date: Date;
    // Actual start timestamp for this occurrence (date + plan's time-of-day).
    date_time: Date;
    // Snapshot of the plan's rooms/duration at materialization time — a shift
    // reflects the plan as it was when created, not whatever the plan becomes later.
    rooms: Types.ObjectId[];
    duration_minutes: number;
    assigned_workers: IAssignedWorker[];
    // true once a manager has edited this shift's workers directly, diverging
    // it from the plan's default assignment.
    is_worker_overridden: boolean;
    status: ShiftStatus;
    last_updated_by?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
