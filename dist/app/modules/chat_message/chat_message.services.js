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
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const socket_1 = require("../../socket/socket");
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const chat_model_1 = require("../chat/chat.model");
const user_constant_1 = require("../user/user.constant");
const chat_message_model_1 = require("./chat_message.model");
const broadcastToChat = (chat, event, payload) => {
    try {
        const io = (0, socket_1.getIO)();
        io.to(`group:${chat._id}`).emit(event, payload);
        // Group, worker<->managers and client<->managers chats broadcast to
        // every manager — a direct 1:1 chat between one client and one
        // worker is private and must not leak to the system-wide manager room.
        if (chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client') {
            io.to('role:manager').emit(event, payload);
        }
        // 'worker' chats have no client at all.
        if (chat.client) {
            io.to(chat.client.toString()).emit(event, payload);
        }
        chat.workers.forEach((workerId) => {
            io.to(workerId.toString()).emit(event, payload);
        });
    }
    catch (_a) {
        // Socket layer may not be initialized (e.g. tests) — REST reads remain
        // the source of truth regardless of whether the realtime nudge fires.
    }
};
const createChatMessage = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { chatId, senderUserId, senderRole, profileId, text, attachments } = params;
    const chat = yield chat_services_1.default.ensureChatAccessOrThrow(chatId, profileId, senderRole);
    if (!chat.is_active) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This chat is no longer active');
    }
    if (!(text === null || text === void 0 ? void 0 : text.trim()) && !(attachments === null || attachments === void 0 ? void 0 : attachments.length)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Message must have text or at least one attachment');
    }
    const message = yield chat_message_model_1.ChatMessage.create({
        chat: chatId,
        sender: senderUserId,
        sender_role: senderRole,
        text: (text === null || text === void 0 ? void 0 : text.trim()) || '',
        attachments: attachments || [],
    });
    yield chat_model_1.Chat.findByIdAndUpdate(chatId, {
        last_message: message._id,
        last_message_at: message.get('createdAt'),
    });
    const populated = yield message.populate('sender', 'full_name profile_photo email');
    // 'direct' chats get the private message:new event; both 'group' and
    // 'worker' chats (manager-visible) get group:new-message.
    const event = chat.type === 'direct' ? 'message:new' : 'group:new-message';
    broadcastToChat(chat, event, populated);
    // Offline push fallback (sendNotification itself no-ops the push side if
    // the recipient turns out to be online) — deliberately excludes managers
    // even for group/worker/client chats: they already get full realtime
    // coverage via the role:manager room, and pushing every manager's device
    // for every single message across every chat would be noise, not signal.
    const recipientProfileIds = [
        chat.client ? chat.client.toString() : null,
        ...chat.workers.map((workerId) => workerId.toString()),
    ].filter((id) => !!id && id !== profileId);
    if (recipientProfileIds.length) {
        (0, eventEmitter_1.emitAppEvent)('chat.message_received', {
            chatId: chatId,
            chatType: chat.type,
            senderUserId,
            recipientProfileIds,
            preview: ((_a = populated.text) === null || _a === void 0 ? void 0 : _a.trim())
                ? populated.text.slice(0, 120)
                : 'Sent an attachment',
        });
    }
    return populated;
});
const deleteChatMessage = (messageId, userId, profileId, role) => __awaiter(void 0, void 0, void 0, function* () {
    const message = yield chat_message_model_1.ChatMessage.findById(messageId);
    if (!message) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Message not found');
    }
    const chat = yield chat_services_1.default.ensureChatAccessOrThrow(message.chat.toString(), profileId, role);
    // message.sender stores the User id (not the Client/Worker/Manager
    // profile id), since sender identity is resolved via User for a name +
    // photo that works uniformly across all three roles — see the interface.
    // Manager moderation (delete-any) applies to group, worker<->managers and
    // client<->managers chats (managers are implicit members of all three); a
    // direct 1:1 chat has no manager involved at all.
    const isModerator = role === user_constant_1.USER_ROLE.manager &&
        (chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client');
    const isSender = message.sender.toString() === userId;
    if (!isModerator && !isSender) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You can only delete your own message');
    }
    message.is_deleted = true;
    message.deleted_at = new Date();
    yield message.save();
    const event = chat.type === 'direct' ? 'message:deleted' : 'group:message-deleted';
    broadcastToChat(chat, event, { _id: message._id, chat: message.chat });
    return message;
});
const getChatMessagesFromDB = (chatId, profileId, role, query) => __awaiter(void 0, void 0, void 0, function* () {
    yield chat_services_1.default.ensureChatAccessOrThrow(chatId, profileId, role);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const [messages, total] = yield Promise.all([
        chat_message_model_1.ChatMessage.find({ chat: chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'full_name profile_photo email'),
        chat_message_model_1.ChatMessage.countDocuments({ chat: chatId }),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        // newest-first from the query, reversed here so the client can render
        // top-to-bottom chronologically without re-sorting on the frontend.
        result: messages.reverse(),
    };
});
// ─── Direct-chat only: mark unseen messages from the other party as seen ───────
const markDirectChatSeen = (chatId, viewerUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield chat_message_model_1.ChatMessage.updateMany({ chat: chatId, sender: { $ne: viewerUserId }, seen: false }, { $set: { seen: true } });
    if (result.modifiedCount === 0)
        return null;
    const chat = yield chat_model_1.Chat.findById(chatId).select('client workers type');
    if (!chat || chat.type !== 'direct' || !chat.client)
        return null;
    try {
        const io = (0, socket_1.getIO)();
        io.to(chat.client.toString()).emit('message:seen', { chatId });
        chat.workers.forEach((workerId) => {
            io.to(workerId.toString()).emit('message:seen', { chatId });
        });
    }
    catch (_b) {
        // best-effort realtime nudge, see note above
    }
    return { modifiedCount: result.modifiedCount };
});
const chatMessageServices = {
    createChatMessage,
    deleteChatMessage,
    getChatMessagesFromDB,
    markDirectChatSeen,
};
exports.default = chatMessageServices;
