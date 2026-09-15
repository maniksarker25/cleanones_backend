import { Schema, model } from 'mongoose';
import { TWorker } from './worker.interface';
import { WorkerType } from './worker.constant';
// worker schema 
const workerSchema = new Schema<TWorker>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, default: null },
        isDeleted: { type: Boolean, default: false },
        phone: { type: String, default: null },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
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
            enum: [...Object.values(WorkerType), null],
            default: null,
        },
        position: {
            type: String,
            default: null,
        },
        address: {
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
        total_earning: {
            type: Number,
            default: 0,
            min: 0,
        },
        total_paid: {
            type: Number,
            default: 0,
            min: 0,
        },
        pending_amount: {
            type: Number,
            default: 0,
            min: 0,
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
        national_id: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const Worker = model<TWorker>('Worker', workerSchema, 'worker_profiles');
