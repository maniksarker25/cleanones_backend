import { Types } from 'mongoose';

export interface TClient {
    user: Types.ObjectId;
    company_name?: string;
}

