"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILE_FIELDS_BY_ROLE = exports.PROFILE_MODEL_BY_ROLE = exports.UserStatus = exports.USER_ROLE = void 0;
exports.USER_ROLE = {
    admin: 'admin',
    superAdmin: 'superAdmin',
    worker: 'worker',
    client: 'client',
    manager: 'manager',
};
exports.UserStatus = ['in-progress', 'blocked'];
exports.PROFILE_MODEL_BY_ROLE = {
    worker: 'Worker',
    client: 'Client',
    manager: 'Manager',
    admin: 'Admin',
};
exports.PROFILE_FIELDS_BY_ROLE = {
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
