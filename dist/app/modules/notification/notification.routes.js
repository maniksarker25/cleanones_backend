"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const notification_controller_1 = __importDefault(require("./notification.controller"));
const router = express_1.default.Router();
router.get('/get-notifications', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), notification_controller_1.default.getAllNotification);
router.patch('/see-notifications', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), notification_controller_1.default.seeNotification);
router.delete('/delete-notification/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), notification_controller_1.default.deleteNotification);
exports.notificationRoutes = router;
