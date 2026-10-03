"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const testimonialSchema = new mongoose_1.Schema({
    customer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    details: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        required: true,
    },
}, { timestamps: true });
const TestimonialModel = (0, mongoose_1.model)('Testimonial', testimonialSchema);
exports.default = TestimonialModel;
