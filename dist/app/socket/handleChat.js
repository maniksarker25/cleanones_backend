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
const chat_services_1 = __importDefault(require("../modules/chat/chat.services"));
const chat_message_services_1 = __importDefault(require("../modules/chat_message/chat_message.services"));
const user_constant_1 = require("../modules/user/user.constant");
const helper_1 = require("./helper");
const toSenderRole = (role) => {
    if (role === 'client' || role === 'worker' || role === 'manager') {
        return role;
    }
    return null;
};
const handleChat = (io, socket, currentUserId, profileId, role) => {
    const senderRole = toSenderRole(role);
    // ─── Shared join/leave — works for both group and direct chats since ────
    // both are just documents in the same Chat collection.
    socket.on('group:join', ({ groupId }) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!groupId) {
                return (0, helper_1.emitError)(socket, {
                    code: 400,
                    message: 'groupId is required',
                    type: 'general',
                });
            }
            yield chat_services_1.default.ensureChatAccessOrThrow(groupId, profileId, role);
            socket.join(`group:${groupId}`);
        }
        catch (error) {
            (0, helper_1.emitError)(socket, {
                code: (error === null || error === void 0 ? void 0 : error.statusCode) || 500,
                message: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to join chat',
                type: 'auth',
            });
        }
    }));
    socket.on('group:leave', ({ groupId }) => {
        if (groupId)
            socket.leave(`group:${groupId}`);
    });
    // ─── Group chat messaging (cleaning-plan groups) ───────────────────────
    socket.on('group:send-message', (data, callback) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!senderRole) {
                throw new Error('Only client, worker or manager can send messages');
            }
            const message = yield chat_message_services_1.default.createChatMessage({
                chatId: data === null || data === void 0 ? void 0 : data.groupId,
                senderUserId: currentUserId,
                senderRole,
                profileId,
                text: data === null || data === void 0 ? void 0 : data.text,
                attachments: data === null || data === void 0 ? void 0 : data.attachments,
            });
            callback === null || callback === void 0 ? void 0 : callback({ success: true, data: message });
        }
        catch (error) {
            (0, helper_1.emitError)(socket, {
                code: (error === null || error === void 0 ? void 0 : error.statusCode) || 500,
                message: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to send message',
                type: 'server',
            });
            callback === null || callback === void 0 ? void 0 : callback({ success: false, message: error === null || error === void 0 ? void 0 : error.message });
        }
    }));
    socket.on('group:delete-message', ({ messageId }, callback) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const message = yield chat_message_services_1.default.deleteChatMessage(messageId, currentUserId, profileId, role);
            callback === null || callback === void 0 ? void 0 : callback({ success: true, data: message });
        }
        catch (error) {
            (0, helper_1.emitError)(socket, {
                code: (error === null || error === void 0 ? void 0 : error.statusCode) || 500,
                message: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to delete message',
                type: 'server',
            });
            callback === null || callback === void 0 ? void 0 : callback({ success: false, message: error === null || error === void 0 ? void 0 : error.message });
        }
    }));
    socket.on('group:typing', ({ groupId, name }) => {
        if (!groupId)
            return;
        socket.to(`group:${groupId}`).emit('group:typing', {
            groupId,
            userId: currentUserId,
            name,
        });
    });
    socket.on('group:stop-typing', ({ groupId }) => {
        if (!groupId)
            return;
        socket.to(`group:${groupId}`).emit('group:stop-typing', {
            groupId,
            userId: currentUserId,
        });
    });
    // ─── Direct (1:1) chat — client <-> worker only ────────────────────────
    socket.on('send-message', (data, callback) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            if (role !== user_constant_1.USER_ROLE.client && role !== user_constant_1.USER_ROLE.worker) {
                throw new Error('Only a client or worker can start a direct chat');
            }
            const otherProfileId = (_a = data === null || data === void 0 ? void 0 : data.receiver) === null || _a === void 0 ? void 0 : _a.toString();
            if (!otherProfileId) {
                throw new Error('Receiver is required');
            }
            const clientId = role === user_constant_1.USER_ROLE.client ? profileId : otherProfileId;
            const workerId = role === user_constant_1.USER_ROLE.client ? otherProfileId : profileId;
            const chat = yield chat_services_1.default.findOrCreateDirectChat(clientId, workerId);
            const message = yield chat_message_services_1.default.createChatMessage({
                chatId: chat._id.toString(),
                senderUserId: currentUserId,
                senderRole: role,
                profileId,
                text: data === null || data === void 0 ? void 0 : data.text,
                attachments: data === null || data === void 0 ? void 0 : data.attachments,
            });
            callback === null || callback === void 0 ? void 0 : callback({ success: true, data: message });
        }
        catch (error) {
            (0, helper_1.emitError)(socket, {
                code: (error === null || error === void 0 ? void 0 : error.statusCode) || 500,
                message: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to send message',
                type: 'general',
                details: error === null || error === void 0 ? void 0 : error.message,
            });
            callback === null || callback === void 0 ? void 0 : callback({ success: false, message: error === null || error === void 0 ? void 0 : error.message });
        }
    }));
    socket.on('seen', ({ chatId, conversationId }) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const id = chatId || conversationId;
            if (!id)
                return;
            yield chat_message_services_1.default.markDirectChatSeen(id, currentUserId);
        }
        catch (error) {
            console.error('seen error:', error);
            (0, helper_1.emitError)(socket, {
                code: 500,
                message: 'Failed to update seen status',
                type: 'server',
                details: 'Something went wrong while updating seen status',
            });
        }
    }));
};
exports.default = handleChat;
