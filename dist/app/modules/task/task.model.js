"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
const mongoose_1 = require("mongoose");
// Template only — no photo_url/is_uploaded here, see task.interface.ts.
const photoRequirementSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    reference_image_url: { type: String, default: null, trim: true },
}, { _id: false });
const taskSchema = new mongoose_1.Schema({
    client: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    location: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    room: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    last_updated_by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Manager', default: null },
    name: { type: String, required: true },
    frequency_type: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    is_photo_required: { type: Boolean, default: false },
    photo_requirements: { type: [photoRequirementSchema], default: [] },
    required_photo_count: { type: Number, default: null },
    duration_minutes: { type: Number, required: true },
    days_of_week: { type: [String], default: undefined },
    days_of_month: { type: [Number], default: undefined },
    is_active: { type: Boolean, default: true },
}, {
    timestamps: true,
    versionKey: false,
});
taskSchema.index({ room: 1, is_active: 1 });
exports.Task = (0, mongoose_1.model)('Task', taskSchema);
