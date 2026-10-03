"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manager = void 0;
const mongoose_1 = require("mongoose");
const managerSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        default: null,
    },
    profile_image: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.Manager = (0, mongoose_1.model)('Manager', managerSchema, 'managers');
