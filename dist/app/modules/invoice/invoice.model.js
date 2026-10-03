"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invoice = void 0;
const mongoose_1 = require("mongoose");
const invoiceSchema = new mongoose_1.Schema({
    manager: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Manager',
        required: true,
        index: true,
    },
    worker: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true,
        index: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    payment_method: {
        type: String,
        required: true,
    },
    transaction_id: {
        type: String,
        default: null,
    },
    notes: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.Invoice = (0, mongoose_1.model)('Invoice', invoiceSchema, 'invoices');
