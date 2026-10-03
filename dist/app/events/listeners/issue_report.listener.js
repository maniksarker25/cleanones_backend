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
// Same fan-out rationale as additional_task.listener.ts — no stored manager
// relationship exists to narrow this to one, so every manager gets their own
// notification row.
const notifyAllManagers = (build) => __awaiter(void 0, void 0, void 0, function* () {
    const managers = yield manager_model_1.Manager.find().select('_id').lean();
    yield Promise.all(managers.map((manager) => notification_services_1.default.sendNotification(build(manager._id.toString())).catch((err) => logger_1.errorLogger.error('issue_report notification failed', err))));
});
// A worker filed a new issue report.
(0, eventEmitter_1.onAppEvent)('issue_report.created', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'New issue report',
        message: `A worker reported an issue: "${payload.issueType}" (${payload.severity} severity).`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.ISSUE_REPORT_CREATED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.ISSUE_REPORT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.issueId,
        meta: { issueId: payload.issueId, workerId: payload.workerId },
    }));
}));
// A manager changed an issue report's status — tell the worker who filed it.
(0, eventEmitter_1.onAppEvent)('issue_report.status_changed', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const message = payload.status === 'RESOLVED'
        ? payload.resolutionNote
            ? `Your issue report has been resolved: ${payload.resolutionNote}`
            : 'Your issue report has been resolved.'
        : `Your issue report status was updated to ${payload.status}.`;
    yield notification_services_1.default.sendNotification({
        receiver: payload.workerId,
        title: 'Issue report update',
        message,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.ISSUE_REPORT_STATUS_CHANGED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.ISSUE_REPORT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.issueId,
        meta: { issueId: payload.issueId, status: payload.status },
    }).catch((err) => logger_1.errorLogger.error('issue_report.status_changed notification failed', err));
}));
