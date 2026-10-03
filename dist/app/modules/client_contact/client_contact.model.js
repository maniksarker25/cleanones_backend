"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientContact = void 0;
const mongoose_1 = require("mongoose");
const clientContactSchema = new mongoose_1.Schema({
    client: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.ClientContact = (0, mongoose_1.model)('ClientContact', clientContactSchema, 'client_contacts');
