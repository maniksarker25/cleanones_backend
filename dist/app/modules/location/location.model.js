"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Location = void 0;
const mongoose_1 = require("mongoose");
const locationSchema = new mongoose_1.Schema({
    client: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    last_updated_by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Manager', default: null },
    name: { type: String, required: true },
    address: { type: String, required: true },
    description: { type: String, default: null },
    type: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
    },
}, {
    timestamps: true,
    versionKey: false,
});
locationSchema.index({ client: 1, is_active: 1 });
locationSchema.index({ location: '2dsphere' }, { sparse: true });
exports.Location = (0, mongoose_1.model)('Location', locationSchema);
