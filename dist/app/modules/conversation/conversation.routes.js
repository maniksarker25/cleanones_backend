"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const conversation_controller_1 = __importDefault(require("./conversation.controller"));
const router = express_1.default.Router();
router.get('/get-chat-list', (0, auth_1.default)(user_constant_1.USER_ROLE.worker, user_constant_1.USER_ROLE.client), conversation_controller_1.default.getChatList);
exports.conversationRoutes = router;
