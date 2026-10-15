import { Types } from 'mongoose';

export interface IClientContact {
    manager: Types.ObjectId;
    client: Types.ObjectId;
    name: string;
    role: string;
    phone: string;
    email: string;
}
