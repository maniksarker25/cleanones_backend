import { Types } from 'mongoose';

export interface IClientContact {
    client: Types.ObjectId;
    name: string;
    role: string;
    phone: string;
    email: string;
}
