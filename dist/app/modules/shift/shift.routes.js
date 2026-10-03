"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shiftRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_constant_1 = require("../user/user.constant");
const shift_controller_1 = __importDefault(require("./shift.controller"));
const shift_validation_1 = __importDefault(require("./shift.validation"));
const router = (0, express_1.Router)();
router.get('/my-shifts', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), shift_controller_1.default.listMyShifts);
router.get('/my-active-shift', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), shift_controller_1.default.getMyActiveShift);
router.get('/my-today-meta', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), shift_controller_1.default.getMyTodayMeta);
router.get('/my-next-shift', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), shift_controller_1.default.getMyNextShift);
router.get('/my-live-status', (0, auth_1.default)(user_constant_1.USER_ROLE.client), shift_controller_1.default.getMyLiveStatus);
router.get('/worker-performance/:workerId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getWorkerPerformance);
router.get('/attendance-summary', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getWorkersAttendanceSummary);
router.get('/attendance-summary/:workerId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getWorkerAttendanceSummary);
router.get('/attendance-list', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getWorkersAttendanceList);
router.get('/roster', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getShiftRoster);
router.get('/plan-roster', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getManagerPlanRoster);
router.get('/today-live-shift-meta', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getTodayLiveShiftMeta);
router.get('/report', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getManagerReport);
router.get('/today-live-shifts', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getTodayLiveShifts);
router.get('/photo-review', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getPhotoReviewList);
router.get('/single-live-shift/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getSingleLiveShift);
router.get('/:planId', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.listShifts);
router.get('/:planId/:date', (0, auth_1.default)(user_constant_1.USER_ROLE.manager, user_constant_1.USER_ROLE.worker), shift_controller_1.default.getShift);
router.get('/:planId/:date/eligible-workers', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getEligibleWorkers);
router.patch('/:planId/:date/assign-workers', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(shift_validation_1.default.assignWorkersValidationSchema), shift_controller_1.default.assignWorkers);
// 3-segment path deliberately, not `/:planId/bulk-assign-preview` — a
// 2-segment GET would be silently swallowed by `GET /:planId/:date` above
// (`:date` would just capture the literal string).
router.get('/:planId/bulk-assign/preview', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), shift_controller_1.default.getBulkAssignPreview);
// No other route on this router uses POST, so this can't collide with the
// GET-only `/:planId/:date` pattern regardless of segment count.
router.post('/:planId/bulk-assign', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(shift_validation_1.default.bulkAssignValidationSchema), shift_controller_1.default.bulkAssignWorker);
router.patch('/:planId/:date/status', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(shift_validation_1.default.updateStatusValidationSchema), shift_controller_1.default.updateStatus);
router.patch('/:planId/:date/tasks/:taskId/photo', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), (0, validateRequest_1.default)(shift_validation_1.default.uploadTaskPhotoValidationSchema), shift_controller_1.default.uploadTaskPhoto);
router.patch('/:planId/:date/tasks/:taskId/photo-verdict', (0, auth_1.default)(user_constant_1.USER_ROLE.manager), (0, validateRequest_1.default)(shift_validation_1.default.photoVerdictValidationSchema), shift_controller_1.default.setPhotoVerdict);
router.patch('/:planId/:date/tasks/:taskId/complete', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), shift_controller_1.default.markTaskComplete);
router.patch('/:planId/:date/check-in', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), (0, validateRequest_1.default)(shift_validation_1.default.checkInOutValidationSchema), shift_controller_1.default.checkIn);
router.patch('/:planId/:date/check-out', (0, auth_1.default)(user_constant_1.USER_ROLE.worker), (0, validateRequest_1.default)(shift_validation_1.default.checkInOutValidationSchema), shift_controller_1.default.checkOut);
exports.shiftRoutes = router;
