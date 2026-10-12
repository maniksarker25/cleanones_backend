"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkAssignment = void 0;
const mongoose_1 = require("mongoose");
const bulkAssignmentSchema = new mongoose_1.Schema({
    cleaning_plan: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CleaningPlan', required: true },
    worker: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Worker', required: true },
    manager: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Manager', required: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    reminder_7d_sent_at: { type: Date, default: null },
    reminder_4d_sent_at: { type: Date, default: null },
    renewed_by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'BulkAssignment', default: null },
}, { timestamps: true });
bulkAssignmentSchema.index({ renewed_by: 1, to: 1 });
bulkAssignmentSchema.index({ cleaning_plan: 1, worker: 1, to: -1 });
exports.BulkAssignment = (0, mongoose_1.model)('BulkAssignment', bulkAssignmentSchema);
