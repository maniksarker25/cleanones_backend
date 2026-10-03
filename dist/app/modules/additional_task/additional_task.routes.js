"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.additionalTaskRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const additional_task_controller_1 = __importDefault(require("./additional_task.controller"));
const additional_task_validation_1 = __importDefault(require("./additional_task.validation"));
const router = (0, express_1.Router)();
// ─── Client routes ────────────────────────────────────────────────────────────
router.post('/create-additional-task', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(additional_task_validation_1.default.createAdditionalTaskValidationSchema), additional_task_controller_1.default.createAdditionalTask);
router.patch('/update-additional-task/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(additional_task_validation_1.default.updateAdditionalTaskValidationSchema), additional_task_controller_1.default.updateAdditionalTask);
router.delete('/delete-additional-task/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.client, user_constant_1.USER_ROLE.manager), additional_task_controller_1.default.deleteAdditionalTask);
// ─── Manager routes ───────────────────────────────────────────────────────────
router.patch('/approve-additional-task/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(additional_task_validation_1.default.approveAdditionalTaskValidationSchema), additional_task_controller_1.default.approveAdditionalTask);
// ─── Shared get routes ────────────────────────────────────────────────────────
router.get('/all-additional-tasks', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client), additional_task_controller_1.default.getAllAdditionalTasksByPlan);
router.get('/single-additional-task/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client), additional_task_controller_1.default.getSingleAdditionalTask);
exports.additionalTaskRoutes = router;
