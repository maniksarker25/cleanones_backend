"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const message_controller_1 = __importDefault(require("./message.controller"));
const router = express_1.default.Router();
router.get('/get-messages/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), message_controller_1.default.getMessages);
exports.messageRoutes = router;
