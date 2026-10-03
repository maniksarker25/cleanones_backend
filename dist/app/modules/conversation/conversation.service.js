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
const chat_services_1 = __importDefault(require("../chat/chat.services"));
// Thin wrapper so the existing /conversation route keeps working, backed by
// the unified Chat model instead of the old, broken Conversation model
// (which looked up nonexistent `customers`/`providers` collections). Now
// delegates to the same unified group+direct list as GET /chat/my-chats —
// see chat.services.ts's getMyChatsFromDB for why a single query covers both.
const getConversation = (profileId, role, query) => __awaiter(void 0, void 0, void 0, function* () {
    return chat_services_1.default.getMyChatsFromDB(profileId, role, query);
});
exports.default = { getConversation };
