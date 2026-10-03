"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const mongoose_1 = require("mongoose");
const worker_constant_1 = require("./worker.constant");
// worker schema 
const workerSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    phone: { type: String, default: null },
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    nationality: {
        type: String,
        default: null,
    },
    worker_type: {
        type: String,
        enum: [...Object.values(worker_constant_1.WorkerType), null],
        default: null,
    },
    profile_image: {
        type: String,
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
}, {
    timestamps: true,
    versionKey: false,
});
exports.Worker = (0, mongoose_1.model)('Worker', workerSchema, 'worker_profiles');
