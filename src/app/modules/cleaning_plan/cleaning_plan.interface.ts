import { Types } from 'mongoose';

export type CleaningPlanStatus =
    | 'active'
    | 'inactive'
    | 'completed'


// A blueprint only: WHAT needs cleaning and WHERE, on what recurring
// checklist (via its rooms' Tasks) — no schedule and no crew of its own.
// WHO does it and WHEN is decided per due date, at the Shift level (see
// assignWorkersToShift in shift.services.ts).
export interface ICleaningPlan {
    title: string;
    description:string;
    manager: Types.ObjectId;
    last_updated_by?: Types.ObjectId | null;
    client: Types.ObjectId;
    location: Types.ObjectId;
    rooms: Types.ObjectId[];
    max_estimated_duration: number;
    note?: string | null;
    status: CleaningPlanStatus;
    is_active: boolean;
    createdAt:Date;
    updatedAt:Date;
}