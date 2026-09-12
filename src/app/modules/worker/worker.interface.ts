import { Types } from 'mongoose';
import { WorkerType } from './worker.constant';

export interface TWorker {
    email: string;
    phone?: string;
    user: Types.ObjectId;
    isagree_condition?: boolean;
    dob?: any;
    nationality?: string;
    worker_type: WorkerType;
    position?: string;
    address: string;
    base_location?: string;
    languages: string[];
    employee_contract_pdf?: string;
    working_days: string[];
    hourly_rate: number;
    is_profile_completed: boolean;
    id_card_front?: string;
    id_card_back?: string;
    certificates: string[];
    national_id?: string;
    isDeleted: boolean;
}
