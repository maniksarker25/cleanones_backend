import { Types } from 'mongoose';

export interface TLocation {
    client: Types.ObjectId;
    name: string;
    address: string;
    city?: string;
    postal_code?: string;
    country?: string;
    image_url?: string;
    is_active: boolean;
    geo?: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };
}
