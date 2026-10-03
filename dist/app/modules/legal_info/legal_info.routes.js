"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalInfoRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../user/user.constant");
const legal_info_controller_1 = __importDefault(require("./legal_info.controller"));
const router = express_1.default.Router();
router.post('/add-update', (0, auth_1.default)(user_constant_1.USER_ROLE.superAdmin), legal_info_controller_1.default.addOrUpdateLegalInfo);
router.get('/get', legal_info_controller_1.default.getLegalInfoByVenueOwnerId);
exports.legalInfoRoutes = router;
