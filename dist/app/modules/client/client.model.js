"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const mongoose_1 = require("mongoose");
const client_interface_1 = require("./client.interface");
const clientSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
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
    company_name: {
        type: String,
        default: null,
    },
    profile_image: {
        type: String,
        default: null,
    },
    licence_expiration_date: {
        type: Date,
        default: null,
    },
    contract_status: {
        type: String,
        enum: client_interface_1.CONTRACT_STATUS,
        default: 'Pending',
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.Client = (0, mongoose_1.model)('Client', clientSchema, 'clients');
