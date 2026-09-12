import { Types } from 'mongoose';

export type TTaskFrequency = 'daily' | 'weekly' | 'monthly';

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
    duration_minutes?: number;
    // 'weekly' tasks: which weekdays it's due on ('mon'..'sun')
    days_of_week?: string[];
    // 'monthly' tasks: which days of the month it's due on (1-31)
    days_of_month?: number[];
    is_active: boolean;
}
