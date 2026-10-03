"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatMessageRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const chat_message_controller_1 = __importDefault(require("./chat_message.controller"));
const router = (0, express_1.Router)();
router.get('/:chatId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), chat_message_controller_1.default.getChatMessages);
router.delete('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), chat_message_controller_1.default.deleteChatMessage);
exports.chatMessageRoutes = router;
