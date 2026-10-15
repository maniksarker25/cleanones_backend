import { Types } from 'mongoose';

export interface ICompany {
    _id: string;
    user: Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    company_name: string;
    address?: string | null;
    website?: string | null;
    profile_image?: string | null;
    isActive: boolean;
}
