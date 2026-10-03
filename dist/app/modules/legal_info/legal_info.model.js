"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalInfo = void 0;
const mongoose_1 = require("mongoose");
const LegalInfoSchema = new mongoose_1.Schema({
    venueOwner: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'VenueOwner',
        required: true,
        unique: true,
    },
    companyName: { type: String, required: true, trim: true },
    businessType: { type: String, required: true, trim: true },
    registeredAddress: { type: String, required: true, trim: true },
    contactEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    contactPhone: { type: String, required: true, trim: true },
    jurisdiction: { type: String, required: true, trim: true },
    officialWebsite: { type: String, required: true, trim: true },
    platformFeePercentage: {
        type: Number,
        default: 20,
    },
    freeCancellationHour: {
        type: Number,
        default: 24,
    },
}, { timestamps: true });
exports.LegalInfo = (0, mongoose_1.model)('LegalInfo', LegalInfoSchema);
