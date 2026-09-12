import { Types } from 'mongoose';

export interface TWorker {
    email?: string;
    user: Types.ObjectId;
    employee_id?: string;
    isagree_condition: boolean;
    dob?: any;
    nationality?: string;
    worker_type?: 'full_time' | 'part_time' | 'contractor' | 'freelancer' | 'employee' | null;
    position?: string;
    location?: string;
    base_location?: string;
    languages: string[];
    employee_contract_pdf?: string;
    working_days: string[];
    hourly_rate: number;
    onboarding_draft?: any;
    onboarding_complete1: boolean;
    is_profile_completed: boolean;
    id_card_front?: string;
    id_card_back?: string;
    certificates: string[];
    contract_type?: string;
    national_id?: string;
}
