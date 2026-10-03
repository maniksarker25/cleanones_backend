"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionSuggestionUpdateBody = exports.questionSuggestionBody = void 0;
const zod_1 = require("zod");
exports.questionSuggestionBody = zod_1.z
    .object({
    question: zod_1.z.string().trim().min(1, 'Question is required'),
    answer: zod_1.z.string().trim().min(1, 'Answer is required'),
})
    .strict();
exports.questionSuggestionUpdateBody = exports.questionSuggestionBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
});
exports.default = {
    create: zod_1.z.object({ body: exports.questionSuggestionBody }),
    update: zod_1.z.object({ body: exports.questionSuggestionUpdateBody }),
};
