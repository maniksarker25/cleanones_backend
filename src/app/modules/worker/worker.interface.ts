import { Types } from 'mongoose';
import { WorkerType } from './worker.constant';

export interface TWorker {
    name:string;
    email: string;
    phone?: string;
    user: Types.ObjectId;
    isagree_condition?: boolean;
    dob?: any;
    nationality?: string;
    worker_type: WorkerType;
    profile_image?: string;
    position?: string;
    address: string;
    base_location?: string;
    languages: string[];
    employee_contract_pdf?: string;
    working_days: string[];
    hourly_rate: number;
    total_earning: number;
    total_paid: number;
    pending_amount: number;
    is_profile_completed: boolean;
    id_card_front?: string;
    id_card_back?: string;
    certificates: string[];
    national_id?: string;
    isDeleted: boolean;
}
