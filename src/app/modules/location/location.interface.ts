import { Types } from 'mongoose';

export interface TLocation {
    client: Types.ObjectId;
    name: string;
    address: string;
    is_active: boolean;
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };
}
