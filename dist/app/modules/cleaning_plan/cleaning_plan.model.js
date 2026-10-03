"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleaningPlan = void 0;
const mongoose_1 = require("mongoose");
const cleaningPlanSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    manager: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Manager',
        required: true,
        index: true,
    },
    last_updated_by: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Manager',
        default: null,
    },
    client: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
        index: true,
    },
    location: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
    },
    rooms: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'Room',
        default: [],
    },
    tasks: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'Task',
        default: [],
    },
    max_estimated_duration: {
        type: Number,
        default: 0,
        min: 0,
    },
    note: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'completed'],
        default: 'active',
    },
    is_active: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.CleaningPlan = (0, mongoose_1.model)('CleaningPlan', cleaningPlanSchema, 'cleaning_plans');
