import { Types } from 'mongoose';

export type CleaningPlanStatus =
    | 'active'
    | 'inactive'
    | 'completed'



export interface IAssignedWorker {
    worker: Types.ObjectId;
    role: "Team leader" | "Co-leader" | "Normal worker";
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
    start_date: Date;
    start_time: string;
    note?: string | null;
    status: CleaningPlanStatus;
    is_active: boolean;
    additional_tasks:Types.ObjectId[];
    createdAt:Date;
    updatedAt:Date;
}