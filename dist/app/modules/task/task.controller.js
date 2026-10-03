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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const task_services_1 = __importDefault(require("./task.services"));
const createTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield task_services_1.default.createTaskIntoDB(req.user.profileId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Task created successfully',
        data: result,
    });
}));
const updateTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const _a = req.body, { force: rawForce } = _a, body = __rest(_a, ["force"]);
    const force = rawForce === true || req.query.force === 'true';
    const result = yield task_services_1.default.updateTaskIntoDB(req.user.profileId, req.params.id, body, force);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Task updated successfully',
        data: result,
    });
}));
const deleteTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const force = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.force) === true || req.query.force === 'true';
    const result = yield task_services_1.default.deleteTaskFromDB(req.user.profileId, req.params.id, force);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Task deleted successfully',
        data: result,
    });
}));
const getAllTasksByRoom = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield task_services_1.default.getAllTasksByRoomFromDB(req.params.roomId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Tasks retrieved successfully',
        data: result,
    });
}));
const getMyTasks = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield task_services_1.default.getMyTasksFromDB(req.user.profileId, req.params.roomId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'My tasks retrieved successfully',
        data: result,
    });
}));
const getSingleTask = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield task_services_1.default.getSingleTaskFromDB(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Task retrieved successfully',
        data: result,
    });
}));
const taskController = {
    createTask,
    updateTask,
    deleteTask,
    getAllTasksByRoom,
    getMyTasks,
    getSingleTask,
};
exports.default = taskController;
