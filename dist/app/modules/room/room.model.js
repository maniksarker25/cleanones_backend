"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const mongoose_1 = require("mongoose");
const roomSchema = new mongoose_1.Schema({
    location: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    last_updated_by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Manager', default: null },
    name: { type: String, required: true },
    room_type: { type: String, required: true },
    cleaning_type: { type: String, required: true },
    floor: { type: Number, default: null },
    is_active: { type: Boolean, default: true },
}, {
    timestamps: true,
    versionKey: false,
});
roomSchema.index({ name: 1 });
exports.Room = (0, mongoose_1.model)('Room', roomSchema);
