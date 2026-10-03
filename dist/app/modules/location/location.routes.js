"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const location_controller_1 = __importDefault(require("./location.controller"));
const location_validation_1 = __importDefault(require("./location.validation"));
const router = (0, express_1.Router)();
router.post('/create-location', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(location_validation_1.default.createLocationValidationSchema), location_controller_1.default.createLocation);
router.patch('/update-location/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(location_validation_1.default.updateLocationValidationSchema), location_controller_1.default.updateLocation);
router.delete('/delete-location/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), location_controller_1.default.deleteLocation);
router.get('/all-locations', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), location_controller_1.default.getAllLocations);
router.get('/client-locations/:clientId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), location_controller_1.default.getClientLocations);
router.get('/worker-locations/:workerId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), location_controller_1.default.getWorkerLocations);
// Client: get their own locations
router.get('/my-locations', (0, auth_1.default)(user_constant_1.USER_ROLE.client), location_controller_1.default.getMyLocations);
router.get('/single-location/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.client), location_controller_1.default.getSingleLocation);
exports.locationRoutes = router;
