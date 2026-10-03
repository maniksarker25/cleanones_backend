"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const invoice_controller_1 = __importDefault(require("./invoice.controller"));
const invoice_validation_1 = __importDefault(require("./invoice.validation"));
const router = (0, express_1.Router)();
router.post('/create-invoice', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(invoice_validation_1.default.createInvoiceValidationSchema), invoice_controller_1.default.createInvoice);
router.get('/all-invoices', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), invoice_controller_1.default.getAllInvoices);
router.get('/my-invoices', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), invoice_controller_1.default.getMyInvoices);
exports.invoiceRoutes = router;
