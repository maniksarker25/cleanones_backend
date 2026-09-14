import httpStatus from 'http-status';
import { isObjectIdOrHexString } from 'mongoose';
import AppError from '../../error/appError';
import { QuestionSuggestion } from './question_suggestion.model';
import {
    questionSuggestionBody,
    questionSuggestionUpdateBody,
} from './question_suggestion.validation';

const validateId = (id: string) => {
    if (!isObjectIdOrHexString(id)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Invalid question suggestion ID'
        );
    }
};

const create = async (payload: unknown) => {
    return QuestionSuggestion.create(questionSuggestionBody.parse(payload));
};

const update = async (id: string, payload: unknown) => {
    validateId(id);
    const result = await QuestionSuggestion.findByIdAndUpdate(
        id,
        { $set: questionSuggestionUpdateBody.parse(payload) },
        { new: true, runValidators: true }
    );
    if (!result)
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Question suggestion not found'
        );
    return result;
};

const remove = async (id: string) => {
    validateId(id);
    const result = await QuestionSuggestion.findByIdAndDelete(id);
    if (!result)
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Question suggestion not found'
        );
    return result;
};

const getAll = async () =>
    QuestionSuggestion.find().sort({ createdAt: -1, _id: -1 });

export default { create, update, remove, getAll };
