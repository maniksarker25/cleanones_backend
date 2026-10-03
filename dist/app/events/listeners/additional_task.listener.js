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
// There's no persisted "manager" membership list anywhere in this app (see
// chat.services.ts's ensureChatAccessOrThrow) — every manager has blanket
// access to everything manager-scoped by role, not by a stored relationship.
// Fanning out one Notification per manager mirrors that: each manager gets
// their own row (their own read/seen state) rather than a single shared one.
const notifyAllManagers = (build) => __awaiter(void 0, void 0, void 0, function* () {
    const managers = yield manager_model_1.Manager.find().select('_id').lean();
    yield Promise.all(managers.map((manager) => notification_services_1.default.sendNotification(build(manager._id.toString())).catch((err) => logger_1.errorLogger.error('additional_task notification failed', err))));
});
// A client requested extra, one-off work — every manager needs to see this
// to approve/reject it.
(0, eventEmitter_1.onAppEvent)('additional_task.created', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'New additional task request',
        message: `A client requested extra work: "${payload.name}".`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_CREATED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId, clientId: payload.clientId },
    }));
}));
(0, eventEmitter_1.onAppEvent)('additional_task.approved', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notification_services_1.default.sendNotification({
        receiver: payload.clientId,
        title: 'Additional task approved',
        message: `Your request "${payload.name}" was approved.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_APPROVED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId },
    }).catch((err) => logger_1.errorLogger.error('additional_task.approved notification failed', err));
}));
(0, eventEmitter_1.onAppEvent)('additional_task.rejected', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    yield notification_services_1.default.sendNotification({
        receiver: payload.clientId,
        title: 'Additional task rejected',
        message: payload.rejectReason
            ? `Your request "${payload.name}" was rejected: ${payload.rejectReason}`
            : `Your request "${payload.name}" was rejected.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_REJECTED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId, rejectReason: (_a = payload.rejectReason) !== null && _a !== void 0 ? _a : null },
    }).catch((err) => logger_1.errorLogger.error('additional_task.rejected notification failed', err));
}));
