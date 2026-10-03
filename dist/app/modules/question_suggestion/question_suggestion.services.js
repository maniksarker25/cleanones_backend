"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const question_suggestion_model_1 = require("./question_suggestion.model");
const question_suggestion_validation_1 = require("./question_suggestion.validation");
const validateId = (id) => {
    if (!(0, mongoose_1.isObjectIdOrHexString)(id)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid question suggestion ID');
    }
};
const create = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    return question_suggestion_model_1.QuestionSuggestion.create(question_suggestion_validation_1.questionSuggestionBody.parse(payload));
});
const update = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const result = yield question_suggestion_model_1.QuestionSuggestion.findByIdAndUpdate(id, { $set: question_suggestion_validation_1.questionSuggestionUpdateBody.parse(payload) }, { new: true, runValidators: true });
    if (!result)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Question suggestion not found');
    return result;
});
const remove = (id) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const result = yield question_suggestion_model_1.QuestionSuggestion.findByIdAndDelete(id);
    if (!result)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Question suggestion not found');
    return result;
});
const getAll = () => __awaiter(void 0, void 0, void 0, function* () { return question_suggestion_model_1.QuestionSuggestion.find().sort({ createdAt: -1, _id: -1 }); });
exports.default = { create, update, remove, getAll };
