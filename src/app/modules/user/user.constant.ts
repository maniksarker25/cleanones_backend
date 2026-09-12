export const USER_ROLE = {
    admin: 'admin',
    superAdmin: 'superAdmin',
    worker: 'worker',
    client: 'client',
    manager: 'manager',
} as const;

export const UserStatus = ['in-progress', 'blocked'];

export const PROFILE_MODEL_BY_ROLE = {
    worker: 'Worker',
    client: 'Client',
    manager: 'Manager',
    admin: 'Admin',
};

export const PROFILE_FIELDS_BY_ROLE = {
    worker: [
        'employee_id',
        'isagree_condition',
        'dob',
        'nationality',
        'worker_type',
        'position',
        'location',
        'base_location',
        'languages',
        'employee_contract_pdf',
        'working_days',
        'hourly_rate',
        'onboarding_draft',
        'onboarding_complete1',
        'is_profile_completed',
        'id_card_front',
        'id_card_back',
        'certificates',
        'contract_type',
        'national_id',
    ],
    client: ['company_name'],
    manager: [],
    admin: ['address', 'website'],
};
