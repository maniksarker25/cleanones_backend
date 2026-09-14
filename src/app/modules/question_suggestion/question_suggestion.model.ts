import { Schema, model } from 'mongoose';
import { IQuestionSuggestion } from './question_suggestion.interface';

const questionSuggestionSchema = new Schema<IQuestionSuggestion>(
    {
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
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const QuestionSuggestion = model<IQuestionSuggestion>(
    'QuestionSuggestion',
    questionSuggestionSchema,
    'question_suggestions'
);
