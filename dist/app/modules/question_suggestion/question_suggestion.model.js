"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionSuggestion = void 0;
const mongoose_1 = require("mongoose");
const questionSuggestionSchema = new mongoose_1.Schema({
    question: {
        type: String,
        required: true,
        trim: true,
    },
    answer: {
        type: String,
        required: true,
        trim: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.QuestionSuggestion = (0, mongoose_1.model)('QuestionSuggestion', questionSuggestionSchema, 'question_suggestions');
