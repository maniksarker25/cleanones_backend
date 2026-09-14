import { z } from 'zod';

export const questionSuggestionBody = z
    .object({
        question: z.string().trim().min(1, 'Question is required'),
        answer: z.string().trim().min(1, 'Answer is required'),
    })
    .strict();

export const questionSuggestionUpdateBody = questionSuggestionBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
        message: 'At least one field is required',
    });

export default {
    create: z.object({ body: questionSuggestionBody }),
    update: z.object({ body: questionSuggestionUpdateBody }),
};
