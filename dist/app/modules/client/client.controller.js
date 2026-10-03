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
const appError_1 = __importDefault(require("../../error/appError"));
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const client_services_1 = __importDefault(require("./client.services"));
const createClient = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.createClientIntoDB(req.user.profileId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client created successfully',
        data: result,
    });
}));
const updateClient = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.updateClientIntoDB(req.user.profileId, req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client updated successfully',
        data: result,
    });
}));
const deleteClient = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.deleteClientFromDB(req.user.profileId, req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client deleted successfully',
        data: result,
    });
}));
const getAllClients = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.getAllClientsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Clients retrieved successfully',
        data: result,
    });
}));
const getClientOverview = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.getClientOverviewFromDB(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client overview retrieved successfully',
        data: result,
    });
}));
const getClientScheduleRoster = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.getClientScheduleRosterFromDB(req.user.profileId, req.query.date);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client schedule roster retrieved successfully',
        data: result,
    });
}));
const getClientActiveProgress = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.getClientActiveProgressFromDB(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client active progress retrieved successfully',
        data: result,
    });
}));
const getClientShiftStats = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.getClientShiftStatsFromDB(req.user.profileId, req.query.range);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client shift stats retrieved successfully',
        data: result,
    });
}));
const getClientTotals = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield client_services_1.default.getClientTotalsFromDB(req.user.profileId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client totals retrieved successfully',
        data: result,
    });
}));
const ROSTER_VIEWS = ['day', 'week', 'month'];
const getClientPlanRoster = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const view = (_a = req.query.view) !== null && _a !== void 0 ? _a : 'day';
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
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1 || limit > 50)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'limit must be between 1 and 50');
    }
    const result = yield client_services_1.default.getClientPlanRosterFromDB(req.user.profileId, {
        view: view,
        date,
        year,
        month,
        page,
        limit,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Client plan roster retrieved successfully',
        data: result,
    });
}));
const clientController = {
    createClient,
    updateClient,
    deleteClient,
    getAllClients,
    getClientOverview,
    getClientScheduleRoster,
    getClientActiveProgress,
    getClientShiftStats,
    getClientTotals,
    getClientPlanRoster,
};
exports.default = clientController;
