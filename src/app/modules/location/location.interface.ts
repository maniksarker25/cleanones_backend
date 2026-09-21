import { Types } from 'mongoose';
// add office also
// export const LOCATION_TYPE = ['Hotel', 'School', 'Hospital', 'Office', 'Other'] as const;

// export type TLocationType = (typeof LOCATION_TYPE)[number];

export interface TLocation {
    _id?: string;
    client: Types.ObjectId;
    last_updated_by?: Types.ObjectId;
    name: string;
    address: string;
    description?: string;
    // type: TLocationType;
    type: string;
    is_active: boolean;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
}
