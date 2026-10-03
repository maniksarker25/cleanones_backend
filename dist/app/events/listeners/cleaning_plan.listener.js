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
// A plan was created — it carries no crew of its own (see
// cleaning_plan.interface.ts), so only the client is notified here; workers
// are notified individually once staffed onto a specific shift (see
// shift.listener.ts's shift.worker_assigned handler).
(0, eventEmitter_1.onAppEvent)('cleaning_plan.created', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notification_services_1.default.sendNotification({
        receiver: payload.clientId,
        title: 'New cleaning plan',
        message: `A cleaning plan "${payload.title}" has been created.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_CREATED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.CLEANING_PLAN,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.planId,
        meta: { planId: payload.planId },
    }).catch((err) => logger_1.errorLogger.error('cleaning_plan.created notification failed', err));
}));
// A plan was cancelled — tell the client. The workers affected are notified
// separately (see cleaning_plan.shifts_cancelled below), one consolidated
// notice each rather than folded into this one, since they need a
// worker-specific "your shift" message, not the client-facing plan notice.
(0, eventEmitter_1.onAppEvent)('cleaning_plan.deleted', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield notification_services_1.default.sendNotification({
        receiver: payload.clientId,
        title: 'Cleaning plan cancelled',
        message: `The cleaning plan "${payload.title}" has been cancelled.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_DELETED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.CLEANING_PLAN,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.planId,
        meta: { planId: payload.planId },
    }).catch((err) => logger_1.errorLogger.error('cleaning_plan.deleted notification failed', err));
}));
// Every future ('upcoming') shift under a deleted/deactivated plan was just
// cancelled (see deleteCleaningPlanFromDB in cleaning_plan.services.ts) — one
// consolidated notice per affected worker, not one per shift, since from
// their side "this plan got cancelled" is a single event even if they were
// staffed on several of its future dates.
(0, eventEmitter_1.onAppEvent)('cleaning_plan.shifts_cancelled', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(payload.workerIds.map((workerId) => notification_services_1.default.sendNotification({
        receiver: workerId,
        title: 'Shifts cancelled',
        message: `All of your shifts under "${payload.title}" have been cancelled — the cleaning plan was cancelled.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.CLEANING_PLAN,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.planId,
        meta: { planId: payload.planId },
    }).catch((err) => logger_1.errorLogger.error('cleaning_plan.shifts_cancelled notification failed', err))));
}));
