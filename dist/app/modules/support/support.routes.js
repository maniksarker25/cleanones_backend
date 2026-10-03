"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const support_controller_1 = __importDefault(require("./support.controller"));
const router = express_1.default.Router();
router.post('/create', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.worker), support_controller_1.default.createSupport);
router.get('/get-all', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), support_controller_1.default.getAllSupport);
router.patch('/update-status/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), support_controller_1.default.updateStatus);
router.get('/get-single/:id', support_controller_1.default.getSingle);
exports.supportRoutes = router;
