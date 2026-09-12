import { Schema, model } from 'mongoose';
import { TWorker } from './worker.interface';

const workerSchema = new Schema<TWorker>(
    {
        stripeAccountId: { type: String, default: null },
        isStripeConnected: { type: Boolean, default: false },
        email: { type: String, default: null },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        employee_id: {
            type: String,
            default: null,
        },
        isagree_condition: {
            type: Boolean,
            default: false,
        },
        dob: {
            type: Schema.Types.Mixed,
            default: null,
        },
        nationality: {
            type: String,
            default: null,
        },
        worker_type: {
            type: String,
            enum: ['full_time', 'part_time', 'contractor', 'freelancer', 'employee', null],
            default: null,
        },
        position: {
            type: String,
            default: null,
        },
        location: {
            type: String,
            default: null,
        },
        base_location: {
            type: String,
            default: null,
        },
        languages: {
            type: [String],
            default: [],
        },
        employee_contract_pdf: {
            type: String,
            default: null,
        },
        working_days: {
            type: [String],
            default: [],
        },
        hourly_rate: {
            type: Number,
            default: 25.0,
        },
        onboarding_draft: {
            type: Schema.Types.Mixed,
            default: {},
        },
        onboarding_complete1: {
            type: Boolean,
            default: false,
        },
        is_profile_completed: {
            type: Boolean,
            default: false,
        },
        id_card_front: {
            type: String,
            default: null,
        },
        id_card_back: {
            type: String,
            default: null,
        },
        certificates: {
            type: [String],
            default: [],
        },
        contract_type: {
            type: String,
            default: null,
        },
        national_id: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

export const Worker = model<TWorker>('Worker', workerSchema, 'worker_profiles');
