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
// A client was deleted, taking every active Location under them — and every
// CleaningPlan at those locations, and every one of their staffed future
// shifts — down with it (see deleteClientFromDB in client.services.ts). The
// client themselves gets no notice (their own account is what's being
// deactivated); only the affected workers are notified, one consolidated
// notice each even if they were staffed across several of the client's
// locations/plans.
(0, eventEmitter_1.onAppEvent)('client.deleted', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(payload.workerIds.map((workerId) => notification_services_1.default.sendNotification({
        receiver: workerId,
        title: 'Shifts cancelled',
        message: `All of your shifts for client "${payload.clientName}" have been cancelled.`,
        type: notification_enum_1.ENUM_NOTIFICATION_TYPE.CLIENT_DELETED,
        entity: notification_enum_1.NOTIFICATION_ENTITY.CLIENT,
        action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
        entityId: payload.clientId,
        meta: { clientId: payload.clientId },
    }).catch((err) => logger_1.errorLogger.error('client.deleted notification failed (worker)', err))));
}));
