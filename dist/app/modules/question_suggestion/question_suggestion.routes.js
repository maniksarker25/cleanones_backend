"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionSuggestionRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const question_suggestion_controller_1 = __importDefault(require("./question_suggestion.controller"));
const question_suggestion_validation_1 = __importDefault(require("./question_suggestion.validation"));
const router = (0, express_1.Router)();
router.post('/create-question-suggestion', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(question_suggestion_validation_1.default.create), question_suggestion_controller_1.default.create);
router.patch('/update-question-suggestion/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(question_suggestion_validation_1.default.update), question_suggestion_controller_1.default.update);
router.delete('/delete-question-suggestion/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), question_suggestion_controller_1.default.remove);
router.get('/all-question-suggestions', question_suggestion_controller_1.default.getAll);
exports.questionSuggestionRoutes = router;
