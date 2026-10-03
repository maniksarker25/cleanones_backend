"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const superAdminSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
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
    profile_image: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});
const SuperAdmin = (0, mongoose_1.model)('SuperAdmin', superAdminSchema);
exports.default = SuperAdmin;
