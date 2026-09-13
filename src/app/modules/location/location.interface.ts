import { Types } from 'mongoose';

export const LOCATION_TYPE = ['Hotel', 'School', 'Hospital', 'Other'] as const;

export type TLocationType = (typeof LOCATION_TYPE)[number];

export interface TLocation {
    _id?: string;
    client: Types.ObjectId;
    last_updated_by?: Types.ObjectId;
    name: string;
    address: string;
    description?: string;
    type: TLocationType;
    is_active: boolean;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
}
