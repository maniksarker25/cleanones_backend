import { Types } from 'mongoose';

export type CleaningPlanStatus =
    | 'active'
    | 'inactive'
    | 'completed'



export interface IAssignedWorker {
    worker: Types.ObjectId;
    role: "Team leader" | "Co-leader" | "Normal worker";
    assigned_with_conflict?: boolean;
}

export type ConflictReason = 'double_booked';

export interface IWorkerConflict {
    conflicting_plan_id: Types.ObjectId;
    reason: ConflictReason;
}





export interface ICleaningPlan {
    title: string;
    description:string;
    manager: Types.ObjectId;
    last_updated_by?: Types.ObjectId | null;
    client: Types.ObjectId;
    location: Types.ObjectId;
    rooms: Types.ObjectId[];
    assigned_workers: IAssignedWorker[];
    date_time: Date;
    end_date?: Date | null;
    max_estimated_duration: number;
    note?: string | null;
    status: CleaningPlanStatus;
    is_active: boolean;
    createdAt:Date;
    updatedAt:Date;
}