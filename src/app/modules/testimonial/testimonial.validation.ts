import { z } from 'zod';

// ✅ Create Testimonial Zod Schema
export const createTestimonialZodSchema = z.object({
    body: z.object({
        customer: z.string({ required_error: 'Customer ID is required' }),
        details: z
            .string({ required_error: 'Details are required' })
            .min(1, 'Details cannot be empty'),
        rating: z
            .number({ required_error: 'Rating is required' })
            .min(1, 'Rating must be at least 1')
            .max(5, 'Rating cannot exceed 5'),
    }),
});

// ✅ Update Testimonial Zod Schema
export const updateTestimonialZodSchema = z.object({
    body: z.object({
        customer: z.string().optional(),
        details: z.string().min(1).optional(),
        rating: z.number().min(1).max(5).optional(),
    }),
});

const TestimonialValidations = {
    createTestimonialZodSchema,
    updateTestimonialZodSchema,
};

export default TestimonialValidations;
