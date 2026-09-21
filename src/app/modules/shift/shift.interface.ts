import { Types } from 'mongoose';
import { IPhotoAiFields } from '../photo_ai/photo_ai.interface';

export type ShiftStatus =
    | 'upcoming'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface IAssignedWorker {
    worker: Types.ObjectId;
    role: 'Team leader' | 'Co-leader' | 'Normal worker';
    assigned_with_conflict?: boolean;
}

export type ConflictReason = 'double_booked';

export interface IWorkerConflict {
    conflicting_plan_id: Types.ObjectId;
    reason: ConflictReason;
}

export interface IShiftPhotoRequirement extends IPhotoAiFields {
    title: string;
    description?: string | null;
    reference_image_url?: string | null;
    photo_url: string | null;
    is_uploaded: boolean;
}



export interface IShiftRoom {
    room: Types.ObjectId;
    name: string;
    room_type: string;
}

export interface IShiftLocation {
    location: Types.ObjectId;
    name: string;

    coordinates: {
        type: 'Point';
        coordinates: [number, number];
    } | null;
}

export interface IShiftTask {

    task: Types.ObjectId;

    room?: Types.ObjectId | null;
    name: string;
    duration_minutes: number;
    is_photo_required: boolean;

    photo_requirements: IShiftPhotoRequirement[];
  
    is_completed: boolean;
    completed_at?: Date | null;

    source: 'plan_task' | 'additional_task';
}

export interface IShiftAssignedWorker {
    worker: Types.ObjectId;
    name: string;
    role: 'Team leader' | 'Co-leader' | 'Normal worker';
    assigned_with_conflict: boolean;

    check_in_at?: Date | null;
    check_in_coordinates?: [number, number] | null;
    check_out_at?: Date | null;
    check_out_coordinates?: [number, number] | null;
}

export interface IShift {
    cleaning_plan: Types.ObjectId;
    date: Date;

    date_time: Date;
    end_time: Date;
    location: IShiftLocation;
    rooms: IShiftRoom[];
    tasks: IShiftTask[];
    duration_minutes: number;
    assigned_workers: IShiftAssignedWorker[];
    status: ShiftStatus;
    last_updated_by?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
