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
const eventEmitter_1 = require("../eventEmitter");
const logger_1 = require("../../shared/logger");
const notification_enum_1 = require("../../modules/notification/notification.enum");
const notification_services_1 = __importDefault(require("../../modules/notification/notification.services"));
const manager_model_1 = require("../../modules/manager/manager.model");
// Same fan-out rationale as additional_task.listener.ts — attendance is a
// manager-wide concern, not tied to one specific manager per plan.
const notifyAllManagers = (build) => __awaiter(void 0, void 0, void 0, function* () {
    const managers = yield manager_model_1.Manager.find().select('_id').lean();
    yield Promise.all(managers.map((manager) => notification_services_1.default.sendNotification(build(manager._id.toString())).catch((err) => logger_1.errorLogger.error('shift notification failed', err))));
});
// A worker was newly staffed onto a shift occurrence.
(0, eventEmitter_1.onAppEvent)('shift.worker_assigned', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(payload.addedWorkerIds.map((workerId) => notification_services_1.default.sendNotification({
        receiver: workerId,
        title: 'New shift assignment',
        message: `You've been scheduled for a shift on "${payload.title}".`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_WORKER_ASSIGNED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId, start_date: payload.start_date },
    }).catch((err) => logger_1.errorLogger.error('shift.worker_assigned notification failed', err))));
}));
// A worker was taken off a shift occurrence.
(0, eventEmitter_1.onAppEvent)('shift.worker_removed', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(payload.removedWorkerIds.map((workerId) => notification_services_1.default.sendNotification({
        receiver: workerId,
        title: 'Removed from shift',
        message: `You've been removed from a shift on "${payload.title}".`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_WORKER_REMOVED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId },
    }).catch((err) => logger_1.errorLogger.error('shift.worker_removed notification failed', err))));
}));
// A future, already-staffed shift was cancelled by a task/room recurrence
// edit that took its date out of the plan's pattern (see
// reconcileFutureShiftsForTaskChange in shift.services.ts). Both the crew
// that was scheduled and the client need to know their date fell through.
(0, eventEmitter_1.onAppEvent)('shift.cancelled', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all([
        ...payload.cancelledWorkerIds.map((workerId) => notification_services_1.default.sendNotification({
            receiver: workerId,
            title: 'Shift cancelled',
            message: `Your shift on "${payload.title}" was cancelled — the schedule for this plan changed.`,
            type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
            entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
            action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
            entityId: payload.shiftId,
            meta: { planId: payload.planId, date: payload.date },
        }).catch((err) => logger_1.errorLogger.error('shift.cancelled notification failed (worker)', err))),
        notification_services_1.default.sendNotification({
            receiver: payload.clientId,
            title: 'A scheduled shift was cancelled',
            message: `A shift on "${payload.title}" was cancelled because its schedule changed.`,
            type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
            entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
            action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
            entityId: payload.shiftId,
            meta: { planId: payload.planId, date: payload.date },
        }).catch((err) => logger_1.errorLogger.error('shift.cancelled notification failed (client)', err)),
    ]);
}));
(0, eventEmitter_1.onAppEvent)('shift.checked_in', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'Worker checked in',
        message: `A worker checked in for their shift.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_CHECKED_IN,
        entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId, workerId: payload.workerId, at: payload.at },
    }));
}));
(0, eventEmitter_1.onAppEvent)('shift.checked_out', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'Worker checked out',
        message: `A worker checked out of their shift.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_CHECKED_OUT,
        entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId, workerId: payload.workerId, at: payload.at },
    }));
}));
// Every task on the shift got completed — let the client know their
// cleaning is done, and let managers know too (attendance/QA follow-up).
(0, eventEmitter_1.onAppEvent)('shift.completed', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notification_services_1.default.sendNotification({
        receiver: payload.clientId,
        title: "Today's cleaning completed",
        message: 'All tasks for today have been completed.',
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_COMPLETED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId },
    }).catch((err) => logger_1.errorLogger.error('shift.completed notification failed', err));
    yield notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'Shift completed',
        message: 'A shift has been fully completed.',
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_COMPLETED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.SHIFT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId },
    }));
}));
