"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const chat_controller_1 = __importDefault(require("./chat.controller"));
const chat_validation_1 = __importDefault(require("./chat.validation"));
const router = (0, express_1.Router)();
router.get('/my-chats', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), chat_controller_1.default.getMyChats);
router.get('/:id/members', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), chat_controller_1.default.getGroupMembers);
router.patch('/:id/rename', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(chat_validation_1.default.renameChatGroupValidationSchema), chat_controller_1.default.renameChatGroup);
router.delete('/:id/members/:workerId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), chat_controller_1.default.removeGroupMember);
exports.chatRoutes = router;
