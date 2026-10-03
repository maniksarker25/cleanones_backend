"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalTask = void 0;
const mongoose_1 = require("mongoose");
const additional_task_interface_1 = require("./additional_task.interface");
const photoRequirementSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: null,
        trim: true,
    },
    reference_image_url: {
        type: String,
        default: null,
        trim: true,
    },
    photo_url: {
        type: String,
        default: null,
    },
    is_uploaded: {
        type: Boolean,
        default: false,
    },
}, { _id: false });
const additionalTaskSchema = new mongoose_1.Schema({
    cleaning_plan_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CleaningPlan',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: ""
    },
    duration_minutes: {
        type: Number,
        default: null,
        min: 0,
    },
    is_photo_required: {
        type: Boolean,
        default: false,
    },
    photo_requirements: {
        type: [photoRequirementSchema],
        default: [],
    },
    is_completed: {
        type: Boolean,
        default: false,
    },
    date_time: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: additional_task_interface_1.ADDITIONAL_TASK_STATUS,
        default: 'Pending',
    },
    reject_reason: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.AdditionalTask = (0, mongoose_1.model)('AdditionalTask', additionalTaskSchema);
