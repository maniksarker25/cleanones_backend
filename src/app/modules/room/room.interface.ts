import { Types } from 'mongoose';

export interface TRequiredPhoto {
    name: string;
    frequency_type?: 'daily' | 'weekly' | 'monthly' | null;
}

export interface TRoom {
    location: Types.ObjectId;
    name: string;
    room_type: string;
    floor?: number;
    duration_minutes?: number;
    monthly_cleaning_frequency?: number;
    required_photos: TRequiredPhoto[];
    is_active: boolean;
}
