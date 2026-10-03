"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTestimonialZodSchema = exports.createTestimonialZodSchema = void 0;
const zod_1 = require("zod");
// ✅ Create Testimonial Zod Schema
exports.createTestimonialZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        customer: zod_1.z.string({ required_error: 'Customer ID is required' }),
        details: zod_1.z
            .string({ required_error: 'Details are required' })
            .min(1, 'Details cannot be empty'),
        rating: zod_1.z
            .number({ required_error: 'Rating is required' })
            .min(1, 'Rating must be at least 1')
            .max(5, 'Rating cannot exceed 5'),
    }),
});
// ✅ Update Testimonial Zod Schema
exports.updateTestimonialZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        customer: zod_1.z.string().optional(),
        details: zod_1.z.string().min(1).optional(),
        rating: zod_1.z.number().min(1).max(5).optional(),
    }),
});
const TestimonialValidations = {
    createTestimonialZodSchema: exports.createTestimonialZodSchema,
    updateTestimonialZodSchema: exports.updateTestimonialZodSchema,
};
exports.default = TestimonialValidations;
