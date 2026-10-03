"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const worker_constant_1 = require("./worker.constant");
const VALID_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
];
const daySchema = zod_1.z
    .string()
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase())
    .pipe(zod_1.z.enum([...VALID_DAYS], {
    invalid_type_error: 'Invalid day. Must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday',
}));
const workerBody = zod_1.z
    .object({
    name: zod_1.z.string({ required_error: 'Name is required' }).trim().min(1, 'Name cannot be empty'),
    email: zod_1.z.string().trim().email().toLowerCase(),
    phone: zod_1.z.string().trim().min(1),
    worker_type: zod_1.z.nativeEnum(worker_constant_1.WorkerType),
    profile_image: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    isagree_condition: zod_1.z.boolean().optional(),
    dob: zod_1.z.coerce.date().optional(),
    nationality: zod_1.z.string().optional(),
    position: zod_1.z.string().optional(),
    base_location: zod_1.z.string().optional(),
    languages: zod_1.z.array(zod_1.z.string()).optional(),
    employee_contract_pdf: zod_1.z.string().optional(),
    working_days: zod_1.z.array(daySchema).optional(),
    hourly_rate: zod_1.z.number().finite().nonnegative().optional(),
    is_profile_completed: zod_1.z.boolean().optional(),
    id_card_front: zod_1.z.string().optional(),
    id_card_back: zod_1.z.string().optional(),
    certificates: zod_1.z.array(zod_1.z.string()).optional(),
    national_id: zod_1.z.string().optional(),
})
    .strict();
const createWorkerBody = workerBody
    .extend({
    password: zod_1.z.string().min(6).max(72),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.password === data.confirmPassword, {
    message: 'Password and confirm password must match',
    path: ['confirmPassword'],
});
const updateWorkerBody = workerBody
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
});
const workerListQuery = zod_1.z
    .object({
    searchTerm: zod_1.z.string().max(200).optional(),
    worker_type: zod_1.z.nativeEnum(worker_constant_1.WorkerType).optional(),
    page: zod_1.z.coerce.number().int().positive().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    sort: zod_1.z
        .enum([
        'createdAt',
        '-createdAt',
        'email',
        '-email',
        'hourly_rate',
        '-hourly_rate',
    ])
        .default('-createdAt'),
})
    .strict();
const availabilityBody = zod_1.z
    .object({
    working_days: zod_1.z.array(daySchema),
})
    .strict();
exports.default = {
    availabilityBody,
    availabilityValidationSchema: zod_1.z.object({ body: availabilityBody }),
    createWorkerBody,
    updateWorkerBody,
    workerListQuery,
    createWorkerValidationSchema: zod_1.z.object({ body: createWorkerBody }),
    updateWorkerValidationSchema: zod_1.z.object({ body: updateWorkerBody }),
};
