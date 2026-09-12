import { Types } from 'mongoose';

export const CONTRACT_STATUS = ['Active', 'Inactive', 'Pending'] as const;

export type TContractStatus = (typeof CONTRACT_STATUS)[number];

export interface TClient {
    _id?: string;
    user: Types.ObjectId;
    manager: Types.ObjectId;
    last_updated_by?: Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    company_name?: string;
    licence_expiration_date?: Date;
    contract_status: TContractStatus;
    isDeleted: boolean;
}
