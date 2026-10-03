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
// A location was deleted/deactivated, taking every CleaningPlan at that
// location — and every one of their staffed future shifts — down with it
// (see deleteLocationFromDB in location.services.ts). One notice to the
// client covering every plan under this location at once (not one per
// plan), and one consolidated notice per affected worker (not one per plan
// or per shift) — a worker staffed across several of the location's plans
// still gets exactly one notification.
(0, eventEmitter_1.onAppEvent)('location.deactivated', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all([
        notification_services_1.default.sendNotification({
            receiver: payload.clientId,
            title: 'Location deactivated',
            message: payload.planCount
                ? `The location "${payload.locationName}" was deactivated — ${payload.planCount} cleaning plan(s) and their upcoming shifts were cancelled.`
                : `The location "${payload.locationName}" was deactivated.`,
            type: notification_enum_1.ENUM_NOTIFICATION_TYPE.LOCATION_DEACTIVATED,
            entity: notification_enum_1.NOTIFICATION_ENTITY.LOCATION,
            action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
            entityId: payload.locationId,
            meta: { locationId: payload.locationId },
        }).catch((err) => logger_1.errorLogger.error('location.deactivated notification failed (client)', err)),
        ...payload.workerIds.map((workerId) => notification_services_1.default.sendNotification({
            receiver: workerId,
            title: 'Shifts cancelled',
            message: `All of your shifts under the location "${payload.locationName}" have been cancelled.`,
            type: notification_enum_1.ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
            entity: notification_enum_1.NOTIFICATION_ENTITY.LOCATION,
            action: notification_enum_1.NOTIFICATION_ACTION.VIEW,
            entityId: payload.locationId,
            meta: { locationId: payload.locationId },
        }).catch((err) => logger_1.errorLogger.error('location.deactivated notification failed (worker)', err))),
    ]);
}));
