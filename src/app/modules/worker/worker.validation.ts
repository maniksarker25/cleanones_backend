import { z } from 'zod';
import { WorkerType } from './worker.constant';

const VALID_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;

const daySchema = z
    .string()
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase())
    .pipe(
        z.enum([...VALID_DAYS], {
            invalid_type_error:
                'Invalid day. Must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday',
        })
    );

const workerBody = z
    .object({
        name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name cannot be empty'),
        email: z.string().trim().email().toLowerCase(),
        phone: z.string().trim().min(1),
        worker_type: z.nativeEnum(WorkerType),
        address: z.string().optional(),
        isagree_condition: z.boolean().optional(),
        dob: z.coerce.date().optional(),
        nationality: z.string().optional(),
        position: z.string().optional(),
        base_location: z.string().optional(),
        languages: z.array(z.string()).optional(),
        employee_contract_pdf: z.string().optional(),
        working_days: z.array(daySchema).optional(),
        hourly_rate: z.number().finite().nonnegative().optional(),
        is_profile_completed: z.boolean().optional(),
        id_card_front: z.string().optional(),
        id_card_back: z.string().optional(),
        certificates: z.array(z.string()).optional(),
        national_id: z.string().optional(),
    })
    .strict();

const createWorkerBody = workerBody
    .extend({
        password: z.string().min(6).max(72),
        confirmPassword: z.string(),
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

const workerListQuery = z
    .object({
        searchTerm: z.string().max(200).optional(),
        worker_type: z.nativeEnum(WorkerType).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sort: z
            .enum([
                'created_at',
                '-created_at',
                'email',
                '-email',
                'hourly_rate',
                '-hourly_rate',
            ])
            .default('-created_at'),
    })
    .strict();

export type CreateWorkerInput = z.infer<typeof createWorkerBody>;
const availabilityBody = z
    .object({
        working_days: z.array(daySchema),
    })
    .strict();
export type UpdateWorkerInput = z.infer<typeof updateWorkerBody>;

export default {
    availabilityBody,
    availabilityValidationSchema: z.object({ body: availabilityBody }),
    createWorkerBody,
    updateWorkerBody,
    workerListQuery,
    createWorkerValidationSchema: z.object({ body: createWorkerBody }),
    updateWorkerValidationSchema: z.object({ body: updateWorkerBody }),
};
