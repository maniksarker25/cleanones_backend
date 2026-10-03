"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const mongoose_1 = require("mongoose");
const deviceSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    playerId: {
        type: String,
        required: true,
        unique: true, // important
    },
    platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
        required: true,
    },
    deviceName: String,
    appVersion: String,
    isActive: {
        type: Boolean,
        default: true,
    },
    lastActiveAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
deviceSchema.index({ userId: 1, playerId: 1 }, { unique: true });
exports.Device = (0, mongoose_1.model)('Device', deviceSchema);
