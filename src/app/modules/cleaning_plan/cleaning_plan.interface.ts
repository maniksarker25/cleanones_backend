import { Types } from 'mongoose';

export type CleaningPlanStatus =
    | 'active'
    | 'inactive'
    | 'completed'


// A blueprint only: WHAT needs cleaning and WHERE, on what recurring
// checklist (its own explicitly-selected `tasks`, a subset of the active
// Tasks under `rooms`) — no schedule and no crew of its own. Different plans
// may cover different tasks within the SAME room (e.g. one plan for
// vacuum+dust, another for bathroom+trash in that same room), each staffed
// and scheduled independently. WHO does it and WHEN is decided per due date,
// at the Shift level (see assignWorkersToShift in shift.services.ts).
export interface ICleaningPlan {
    title: string;
    description:string;
    manager: Types.ObjectId;
    last_updated_by?: Types.ObjectId | null;
    client: Types.ObjectId;
    location: Types.ObjectId;
    rooms: Types.ObjectId[];
    // Selected Task ids (each Task's own `room` must be one of `rooms`) —
    // only these tasks are pulled into shifts built from this plan, not
    // every active task under `rooms`. See buildShiftSnapshot.
    tasks: Types.ObjectId[];
    max_estimated_duration: number;
    note?: string | null;
    status: CleaningPlanStatus;
    is_active: boolean;
    createdAt:Date;
    updatedAt:Date;
}