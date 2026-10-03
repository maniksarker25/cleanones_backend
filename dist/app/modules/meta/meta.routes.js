"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const meta_controller_1 = __importDefault(require("./meta.controller"));
const router = express_1.default.Router();
router.get('/meta-data', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin), meta_controller_1.default.getDashboardMetaData);
router.get('/customer-chart-data', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin), meta_controller_1.default.getCustomerChartData);
router.get('/provider-chart-data', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin), meta_controller_1.default.getProviderChartData);
router.get('/earning-chart-data', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin), meta_controller_1.default.getEarningChartData);
router.get('/get-activities', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin, user_constant_1.USER_ROLE.admin), meta_controller_1.default.getActivities);
exports.metaRoutes = router;
