"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const adminSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        default: '',
    },
    profile_image: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    address: {
        type: String,
        default: null,
    },
    website: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});
const Admin = (0, mongoose_1.model)('Admin', adminSchema);
exports.default = Admin;
