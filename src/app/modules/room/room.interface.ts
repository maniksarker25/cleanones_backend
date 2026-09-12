import { Types } from 'mongoose';


export interface TRoom {
    location: Types.ObjectId;
    name: string;
    room_type: string;
    floor?: number;
    is_active: boolean;
}
