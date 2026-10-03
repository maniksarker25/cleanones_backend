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
const notification_services_1 = __importDefault(require("../../modules/notification/notification.services"));
// Realtime delivery to connected sockets already happens directly inside
// chat_message.services.ts (createChatMessage's broadcastToChat). This event
// exists only to cover offline recipients with an OS push — deliberately
// via sendChatPushNotification, NOT sendNotification: chat messages don't
// get a Notification row (would flood the generic notification list, one
// row per message) and the push is collapsed per-chat (see
// sendChatPushNotification's own comment) so an offline recipient gets one
// "new messages" tray entry, not one per message. sendChatPushNotification
// already no-ops for an online recipient, so this is safe to call
// unconditionally for every recipient without pre-filtering by presence.
(0, eventEmitter_1.onAppEvent)('chat.message_received', (payload) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(payload.recipientProfileIds.map((receiver) => notification_services_1.default.sendChatPushNotification({
        receiver,
        title: 'New message',
        message: payload.preview,
        chatId: payload.chatId,
        data: { chatType: payload.chatType },
    }).catch((err) => logger_1.errorLogger.error('chat.message_received push notification failed', err))));
}));
