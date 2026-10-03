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
const chat_message_services_1 = __importDefault(require("../chat_message/chat_message.services"));
// Thin wrapper so the existing /message route keeps working, backed by the
// unified ChatMessage model instead of the old, broken Message model (which
// looked up nonexistent `customers`/`providers` collections).
const getMessagesByConversationId = (profileId, role, chatId, query) => __awaiter(void 0, void 0, void 0, function* () {
    return chat_message_services_1.default.getChatMessagesFromDB(chatId, profileId, role, query);
});
const MessageService = {
    getMessagesByConversationId,
};
exports.default = MessageService;
