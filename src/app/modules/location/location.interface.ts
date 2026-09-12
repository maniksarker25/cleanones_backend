import { Types } from 'mongoose';

export interface TLocation {
    _id?: string;
    client: Types.ObjectId;
    last_updated_by?: Types.ObjectId;
    name: string;
    address: string;
    is_active: boolean;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
}
