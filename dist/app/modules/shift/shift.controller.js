"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const user_constant_1 = require("../user/user.constant");
const worker_constant_1 = require("../worker/worker.constant");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const shift_services_1 = __importDefault(require("./shift.services"));
const shift_validation_1 = __importDefault(require("./shift.validation"));
const listMyShifts = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { date } = shift_validation_1.default.workerShiftsQuery.parse(req.query);
    const result = yield shift_services_1.default.listWorkerShiftsForDate(req.user.profileId, new Date(date));
    const plans = result.length
        ? yield cleaning_plan_model_1.CleaningPlan.find({
            _id: { $in: [...new Set(result.map((shift) => shift.cleaning_plan.toString()))] },
        }).select('title').lean()
        : [];
    const planTitles = new Map(plans.map((plan) => [plan._id.toString(), plan.title]));
    const shifts = result.map((shift) => {
        var _a;
        return (Object.assign(Object.assign({}, shift), { cleaning_plan: {
                _id: shift.cleaning_plan,
                title: (_a = planTitles.get(shift.cleaning_plan.toString())) !== null && _a !== void 0 ? _a : null,
            } }));
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shifts retrieved successfully',
        data: shifts,
    });
}));
const getMyActiveShift = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getActiveShiftForWorker(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Active shift retrieved successfully',
        data: result,
    });
}));
const getMyTodayMeta = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getWorkerTodayMetaFromDB(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Today's shift metadata retrieved successfully",
        data: result,
    });
}));
const getMyNextShift = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getNextShiftForWorker(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Next shift retrieved successfully',
        data: result,
    });
}));
const getTodayLiveShiftMeta = (0, catchasync_1.default)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getTodayLiveShiftMetaFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Today's live shift metadata retrieved successfully",
        data: result,
    });
}));
const getManagerReport = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { period } = shift_validation_1.default.managerReportQuery.parse(req.query);
    const result = yield shift_services_1.default.getManagerReportFromDB(period);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Manager report retrieved successfully',
        data: result,
    });
}));
const getTodayLiveShifts = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getTodayLiveShiftsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Today's live shifts retrieved successfully",
        data: result,
    });
}));
const getSingleLiveShift = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getSingleLiveShiftFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shift retrieved successfully',
        data: result,
    });
}));
const getWorkerPerformance = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const month = req.query.month !== undefined ? Number(req.query.month) : undefined;
    const year = req.query.year !== undefined ? Number(req.query.year) : undefined;
    if (month !== undefined && Number.isNaN(month)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid month');
    }
    if (year !== undefined && Number.isNaN(year)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid year');
    }
    const result = yield shift_services_1.default.getWorkerPerformanceFromDB(req.params.workerId, month, year);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Worker performance retrieved successfully',
        data: result,
    });
}));
const ATTENDANCE_SUMMARY_PERIODS = ['today', 'weekly', 'monthly'];
const getWorkersAttendanceSummary = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const period = (_a = req.query.period) !== null && _a !== void 0 ? _a : 'today';
    if (!ATTENDANCE_SUMMARY_PERIODS.includes(period)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "period must be one of 'today', 'weekly', 'monthly'");
    }
    const result = yield shift_services_1.default.getWorkersAttendanceSummaryFromDB(period);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Workers attendance summary retrieved successfully',
        data: result,
    });
}));
const getWorkerAttendanceSummary = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const period = (_b = req.query.period) !== null && _b !== void 0 ? _b : 'today';
    if (!ATTENDANCE_SUMMARY_PERIODS.includes(period)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "period must be one of 'today', 'weekly', 'monthly'");
    }
    const result = yield shift_services_1.default.getWorkerAttendanceSummaryFromDB(req.params.workerId, period);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Worker attendance summary retrieved successfully',
        data: result,
    });
}));
const getWorkersAttendanceList = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    const period = (_c = req.query.period) !== null && _c !== void 0 ? _c : 'today';
    if (!ATTENDANCE_SUMMARY_PERIODS.includes(period)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "period must be one of 'today', 'weekly', 'monthly'");
    }
    const typeParam = req.query.type;
    let workerType;
    if (typeParam && typeParam.toLowerCase() !== 'all') {
        if (!Object.values(worker_constant_1.WorkerType).includes(typeParam)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, "type must be one of 'all', 'Employee', 'Freelancer'");
        }
        workerType = typeParam;
    }
    const searchTerm = ((_d = req.query.search) === null || _d === void 0 ? void 0 : _d.trim()) || undefined;
    const result = yield shift_services_1.default.getWorkersAttendanceListFromDB(period, searchTerm, workerType);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Workers attendance list retrieved successfully',
        data: result,
    });
}));
const ROSTER_VIEWS = ['day', 'week', 'month'];
const getShiftRoster = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f;
    const view = (_e = req.query.view) !== null && _e !== void 0 ? _e : 'day';
    if (!ROSTER_VIEWS.includes(view)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "view must be one of 'day', 'week', 'month'");
    }
    const date = req.query.date;
    const year = req.query.year !== undefined ? Number(req.query.year) : undefined;
    const month = req.query.month !== undefined ? Number(req.query.month) : undefined;
    if (year !== undefined && Number.isNaN(year)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid year');
    }
    if (month !== undefined && Number.isNaN(month)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid month');
    }
    const typeParam = req.query.type;
    let workerType;
    if (typeParam && typeParam.toLowerCase() !== 'all') {
        if (!Object.values(worker_constant_1.WorkerType).includes(typeParam)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, "type must be one of 'all', 'Employee', 'Freelancer'");
        }
        workerType = typeParam;
    }
    const searchTerm = ((_f = req.query.search) === null || _f === void 0 ? void 0 : _f.trim()) || undefined;
    const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    if (page !== undefined && (Number.isNaN(page) || page < 1)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'page must be a positive integer');
    }
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1 || limit > 100)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'limit must be between 1 and 100');
    }
    const client = req.query.client || undefined;
    const location = req.query.location || undefined;
    const result = yield shift_services_1.default.getShiftRosterFromDB({
        view: view,
        date,
        year,
        month,
        searchTerm,
        workerType,
        client,
        location,
        page,
        limit,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shift roster retrieved successfully',
        data: result,
    });
}));
const getManagerPlanRoster = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h;
    const view = (_g = req.query.view) !== null && _g !== void 0 ? _g : 'day';
    if (!ROSTER_VIEWS.includes(view)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "view must be one of 'day', 'week', 'month'");
    }
    const date = req.query.date;
    const year = req.query.year !== undefined ? Number(req.query.year) : undefined;
    const month = req.query.month !== undefined ? Number(req.query.month) : undefined;
    if (year !== undefined && Number.isNaN(year)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid year');
    }
    if (month !== undefined && Number.isNaN(month)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid month');
    }
    const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    if (page !== undefined && (Number.isNaN(page) || page < 1)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'page must be a positive integer');
    }
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1 || limit > 100)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'limit must be between 1 and 100');
    }
    const client = req.query.client || undefined;
    const location = req.query.location || undefined;
    const searchTerm = ((_h = req.query.search) === null || _h === void 0 ? void 0 : _h.trim()) || undefined;
    const result = yield shift_services_1.default.getManagerPlanRosterFromDB({
        view: view,
        date,
        year,
        month,
        page,
        limit,
        client,
        location,
        searchTerm,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cleaning plan roster retrieved successfully',
        data: result,
    });
}));
const getPhotoReviewList = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { from, to, planId, locationId } = req.query;
    const fromDate = from ? parseDateParam(String(from), 'from') : undefined;
    const toDate = to ? parseDateParam(String(to), 'to') : undefined;
    if (planId !== undefined && !mongoose_1.default.isValidObjectId(String(planId))) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid planId');
    }
    if (locationId !== undefined && !mongoose_1.default.isValidObjectId(String(locationId))) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid locationId');
    }
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !['pending', 'decided', 'all'].includes(status)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'status must be pending, decided or all');
    }
    const result = yield shift_services_1.default.getPhotoReviewListFromDB({
        from: fromDate,
        to: toDate,
        planId: planId !== undefined ? String(planId) : undefined,
        locationId: locationId !== undefined ? String(locationId) : undefined,
        status: status,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Photo review list retrieved successfully',
        data: result,
    });
}));
const getMyLiveStatus = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_services_1.default.getClientLiveShiftsFromDB(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Live shift status retrieved successfully',
        data: result,
    });
}));
const parseDateParam = (value, label = 'date') => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid ${label}: ${value}`);
    }
    return date;
};
const listShifts = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { from, to } = req.query;
    const fromDate = from
        ? parseDateParam(String(from), 'from')
        : new Date();
    const toDate = to
        ? parseDateParam(String(to), 'to')
        : (() => {
            const d = new Date(fromDate);
            d.setUTCDate(d.getUTCDate() + 30);
            return d;
        })();
    const result = yield shift_services_1.default.listShiftsInRange(req.params.planId, fromDate, toDate);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shifts retrieved successfully',
        data: result,
    });
}));
const getShift = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const requestingWorkerId = req.user.role === user_constant_1.USER_ROLE.worker
        ? req.user.profileId
        : undefined;
    const result = yield shift_services_1.default.getShiftForDate(req.params.planId, date, requestingWorkerId);
    if (!result) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This cleaning plan has no occurrence on the given date');
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shift retrieved successfully',
        data: result,
    });
}));
const getEligibleWorkers = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    if (!req.query.start_time || !req.query.end_time) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'start_time and end_time query parameters are required');
    }
    const startTime = parseDateParam(String(req.query.start_time), 'start_time');
    const endTime = parseDateParam(String(req.query.end_time), 'end_time');
    const result = yield shift_services_1.default.listEligibleWorkersForShift(req.params.planId, date, startTime, endTime);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Eligible workers retrieved successfully',
        data: result,
    });
}));
const assignWorkers = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const force = req.body.force === true || req.query.force === 'true';
    const result = yield shift_services_1.default.assignWorkersToShift(req.user.profileId, req.params.planId, date, req.body.assigned_workers, new Date(req.body.start_time), new Date(req.body.end_time), force);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shift workers assigned successfully',
        data: result,
    });
}));
const getBulkAssignPreview = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { worker, from, to } = shift_validation_1.default.bulkAssignPreviewQuery.parse(req.query);
    const result = yield shift_services_1.default.previewBulkAssignForWorker(req.params.planId, worker, new Date(from), new Date(to));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bulk assign preview retrieved successfully',
        data: result,
    });
}));
const bulkAssignWorker = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const force = req.body.force === true || req.query.force === 'true';
    const result = yield shift_services_1.default.bulkAssignWorkerToShifts(req.user.profileId, req.params.planId, req.body.worker, req.body.role, req.body.dates.map((d) => new Date(d)), new Date(req.body.start_time), new Date(req.body.end_time), force);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bulk assignment completed',
        data: result,
    });
}));
const updateStatus = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const result = yield shift_services_1.default.updateShiftStatus(req.user.profileId, req.params.planId, date, req.body.status);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shift status updated successfully',
        data: result,
    });
}));
const uploadTaskPhoto = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const result = yield shift_services_1.default.uploadShiftTaskPhoto(req.user.profileId, req.params.planId, date, req.params.taskId, req.body.title, req.body.photo_url);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Photo uploaded successfully',
        data: result,
    });
}));
const setPhotoVerdict = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const result = yield shift_services_1.default.setPhotoVerdict(req.user.profileId, req.params.planId, date, req.params.taskId, req.body.title, req.body.verdict, req.body.note);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Photo verdict recorded successfully',
        data: result,
    });
}));
const markTaskComplete = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const result = yield shift_services_1.default.markShiftTaskComplete(req.user.profileId, req.params.planId, date, req.params.taskId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Task marked as completed',
        data: result,
    });
}));
const checkIn = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const result = yield shift_services_1.default.checkInToShift(req.user.profileId, req.params.planId, date, [req.body.longitude, req.body.latitude]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Checked in successfully',
        data: result,
    });
}));
const checkOut = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const date = parseDateParam(req.params.date);
    const result = yield shift_services_1.default.checkOutFromShift(req.user.profileId, req.params.planId, date, [req.body.longitude, req.body.latitude]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Checked out successfully',
        data: result,
    });
}));
const shiftController = {
    listMyShifts,
    getMyActiveShift,
    getMyTodayMeta,
    getMyNextShift,
    getTodayLiveShiftMeta,
    getManagerReport,
    getTodayLiveShifts,
    getSingleLiveShift,
    getMyLiveStatus,
    getWorkerPerformance,
    getWorkersAttendanceSummary,
    getWorkerAttendanceSummary,
    getWorkersAttendanceList,
    getShiftRoster,
    getManagerPlanRoster,
    getPhotoReviewList,
    setPhotoVerdict,
    listShifts,
    getShift,
    getEligibleWorkers,
    assignWorkers,
    getBulkAssignPreview,
    bulkAssignWorker,
    updateStatus,
    uploadTaskPhoto,
    markTaskComplete,
    checkIn,
    checkOut,
};
exports.default = shiftController;
