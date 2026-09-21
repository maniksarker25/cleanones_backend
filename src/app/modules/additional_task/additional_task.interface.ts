import { Types } from "mongoose";

export interface IPhotoRequirement {
    title: string;        // photo label defined by admin (e.g. "Before cleaning")
    // Both optional — same guidance fields as Task's ITaskPhotoRequirement,
    // reserved for future AI-assisted photo verification.
    description?: string | null;
    reference_image_url?: string | null;
    photo_url: string | null;  // uploaded by worker, null until uploaded
    is_uploaded: boolean;
}

export const ADDITIONAL_TASK_STATUS = ['Pending', 'Approved', 'Rejected'] as const;

export type TAdditionalTaskStatus = (typeof ADDITIONAL_TASK_STATUS)[number];

export interface IAdditionalTask {
    cleaning_plan_id: Types.ObjectId;
    name: string;
    description?:string;
    duration_minutes?: number | null;
    is_photo_required: boolean;
    photo_requirements: IPhotoRequirement[]; // required photos with titles
    is_completed: boolean;
    date_time: Date;
    status: TAdditionalTaskStatus;
    // Manager-supplied reason when status is 'Rejected'. Cleared back to null
    // if the task is later approved instead.
    reject_reason?: string | null;
}