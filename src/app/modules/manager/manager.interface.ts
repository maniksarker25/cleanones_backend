import { Types } from 'mongoose';

export interface TManager {
    user: Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    address?: string;
    profile_image?: string;
}
