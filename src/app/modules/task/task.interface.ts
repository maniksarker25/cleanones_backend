import { Types } from 'mongoose';

export type TTaskFrequency = 'daily' | 'weekly' | 'monthly';

// A Task is a recurring template shared across every occurrence (Shift) it
// produces, so it only records WHICH photos are required — not upload state
// (photo_url/is_uploaded), which is per-occurrence and lives on the Shift's
// own task-instance snapshot instead. See docs/SHIFT_MANAGEMENT_DESIGN.md.
export interface ITaskPhotoRequirement {
    title: string;
}

export const WEEKDAYS = [
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
] as const;

export interface TTask {
    client: Types.ObjectId;
    location: Types.ObjectId;
    room: Types.ObjectId;
    last_updated_by?: Types.ObjectId;
    name: string;
    frequency_type: TTaskFrequency;
    is_photo_required: boolean;
    // Pool of possible photo names the manager can require.
    photo_requirements?: ITaskPhotoRequirement[];
    // How many of the pool to randomly require per occurrence — required
    // when is_photo_required is true, must be <= photo_requirements.length.
    required_photo_count?: number;
    duration_minutes?: number;
    // 'weekly' tasks: which weekdays it's due on ('mon'..'sun')
    days_of_week?: string[];
    // 'monthly' tasks: which days of the month it's due on (1-31)
    days_of_month?: number[];
    is_active: boolean;
    // Recurrence anchor for this task's occurrences (see availability.util's
    // occursOnDate) — a task is never "due" before it existed.
    createdAt: Date;
    updatedAt: Date;
}
