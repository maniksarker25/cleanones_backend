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
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const appError_1 = __importDefault(require("../../error/appError"));
const room_model_1 = require("../room/room.model");
const shift_services_1 = __importDefault(require("../shift/shift.services"));
const task_model_1 = require("./task.model");
const resolveRoomHierarchy = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const room = yield room_model_1.Room.findOne({ _id: roomId, is_active: true });
    if (!room) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Room not found');
    }
    const location = yield room.populate('location');
    const populatedLocation = location.location;
    if (!populatedLocation || !populatedLocation.is_active) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Location not found');
    }
    return {
        room: room._id,
        location: populatedLocation._id,
        client: populatedLocation.client,
    };
});
const createTaskIntoDB = (managerId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const hierarchy = yield resolveRoomHierarchy(payload.room.toString());
    const result = yield task_model_1.Task.create(Object.assign(Object.assign({}, payload), { client: hierarchy.client, location: hierarchy.location, room: hierarchy.room, last_updated_by: managerId }));
    yield shift_services_1.default.resyncTodayShiftTasksForRoomsIfDue([hierarchy.room]);
    return result;
});
// Whether this update actually touches a field that occursOnDate cares
// about — a plain rename/duration/photo edit never changes WHICH dates the
// task is due on, so it's not worth the extra plan/shift scan below.
const changesRecurrence = (task, payload) => {
    var _a, _b;
    if (payload.is_active === false && task.is_active !== false)
        return true;
    if (payload.frequency_type !== undefined &&
        payload.frequency_type !== task.frequency_type)
        return true;
    if (payload.days_of_week !== undefined &&
        JSON.stringify(payload.days_of_week) !==
            JSON.stringify((_a = task.days_of_week) !== null && _a !== void 0 ? _a : []))
        return true;
    if (payload.days_of_month !== undefined &&
        JSON.stringify(payload.days_of_month) !==
            JSON.stringify((_b = task.days_of_month) !== null && _b !== void 0 ? _b : []))
        return true;
    return false;
};
const updateTaskIntoDB = (managerId, id, payload, force = false) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const task = yield task_model_1.Task.findById(id);
    if (!task) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found');
    }
    const recurrenceChanged = changesRecurrence(task, payload);
    if (recurrenceChanged) {
        const willStayActive = payload.is_active !== false;
        // Reconciles/blocks BEFORE the Task write itself — a 409 here (no
        // force) must leave the task untouched, not half-applied.
        yield shift_services_1.default.reconcileFutureShiftsForTaskChange([task.room], task._id, willStayActive
            ? {
                frequency_type: (_a = payload.frequency_type) !== null && _a !== void 0 ? _a : task.frequency_type,
                days_of_week: (_b = payload.days_of_week) !== null && _b !== void 0 ? _b : task.days_of_week,
                days_of_month: (_c = payload.days_of_month) !== null && _c !== void 0 ? _c : task.days_of_month,
                createdAt: task.createdAt,
            }
            : null, managerId, force);
    }
    const result = yield task_model_1.Task.findByIdAndUpdate(id, Object.assign(Object.assign({}, payload), { last_updated_by: managerId }), {
        new: true,
        runValidators: true,
    });
    yield shift_services_1.default.resyncTodayShiftTasksForRoomsIfDue([task.room]);
    if (recurrenceChanged) {
        yield shift_services_1.default.resyncFutureShiftTasksForRoomsIfDue([task.room]);
    }
    return result;
});
const deleteTaskFromDB = (managerId, id, force = false) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield task_model_1.Task.findById(id);
    if (!task) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found');
    }
    // A deleted/deactivated task drops out of the plan's recurrence pattern
    // exactly like an edit that no longer covers a date — same reconcile
    // gate, same 409-unless-force behavior, run before the write.
    yield shift_services_1.default.reconcileFutureShiftsForTaskChange([task.room], task._id, null, managerId, force);
    const result = yield task_model_1.Task.findByIdAndUpdate(id, { is_active: false, last_updated_by: managerId }, { new: true });
    yield shift_services_1.default.resyncTodayShiftTasksForRoomsIfDue([task.room]);
    yield shift_services_1.default.resyncFutureShiftTasksForRoomsIfDue([task.room]);
    return result;
});
const getAllTasksByRoomFromDB = (roomId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const room = yield room_model_1.Room.findOne({ _id: roomId, is_active: true });
    if (!room) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Room not found');
    }
    const taskQuery = new QueryBuilder_1.default(task_model_1.Task.find({ room: roomId, is_active: true })
        .populate('client', 'name email phone company_name')
        .populate('location', 'name address')
        .populate('room', 'name room_type cleaning_type floor')
        .populate({
        path: 'last_updated_by',
        populate: { path: 'user', select: 'email phone' },
    }), query)
        .search(['name'])
        .filter()
        .fields()
        .paginate()
        .sort();
    const meta = yield taskQuery.countTotal();
    const result = yield taskQuery.modelQuery;
    return {
        meta,
        result,
    };
});
const getMyTasksFromDB = (clientId, roomId, query) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e;
    const room = yield room_model_1.Room.findOne({ _id: roomId, is_active: true }).populate('location');
    if (!room || ((_e = (_d = room.location) === null || _d === void 0 ? void 0 : _d.client) === null || _e === void 0 ? void 0 : _e.toString()) !== clientId) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Room not found');
    }
    return getAllTasksByRoomFromDB(roomId, query);
});
const getSingleTaskFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield task_model_1.Task.findById(id)
        .populate('client', 'name email phone company_name')
        .populate('location', 'name address')
        .populate('room', 'name room_type cleaning_type floor')
        .populate({
        path: 'last_updated_by',
        populate: { path: 'user', select: 'email phone' },
    });
    if (!task) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found');
    }
    return task;
});
const taskServices = {
    createTaskIntoDB,
    updateTaskIntoDB,
    deleteTaskFromDB,
    getAllTasksByRoomFromDB,
    getMyTasksFromDB,
    getSingleTaskFromDB,
};
exports.default = taskServices;
