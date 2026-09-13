import { Server as IOServer, Socket } from 'socket.io';
import chatServices from '../modules/chat/chat.services';
import chatMessageServices from '../modules/chat_message/chat_message.services';
import { TChatMessageSenderRole } from '../modules/chat_message/chat_message.interface';
import { USER_ROLE } from '../modules/user/user.constant';
import { emitError } from './helper';

const toSenderRole = (role: string): TChatMessageSenderRole | null => {
    if (role === 'client' || role === 'worker' || role === 'manager') {
        return role;
    }
    return null;
};

const handleChat = (
    io: IOServer,
    socket: Socket,
    currentUserId: string,
    profileId: string,
    role: string
): void => {
    const senderRole = toSenderRole(role);

    // ─── Shared join/leave — works for both group and direct chats since ────
    // both are just documents in the same Chat collection.
    socket.on('group:join', async ({ groupId }) => {
        try {
            if (!groupId) {
                return emitError(socket, {
                    code: 400,
                    message: 'groupId is required',
                    type: 'general',
                });
            }
            await chatServices.ensureChatAccessOrThrow(groupId, profileId, role);
            socket.join(`group:${groupId}`);
        } catch (error: any) {
            emitError(socket, {
                code: error?.statusCode || 500,
                message: error?.message || 'Failed to join chat',
                type: 'auth',
            });
        }
    });

    socket.on('group:leave', ({ groupId }) => {
        if (groupId) socket.leave(`group:${groupId}`);
    });

    // ─── Group chat messaging (cleaning-plan groups) ───────────────────────

    socket.on('group:send-message', async (data, callback) => {
        try {
            if (!senderRole) {
                throw new Error(
                    'Only client, worker or manager can send messages'
                );
            }

            const message = await chatMessageServices.createChatMessage({
                chatId: data?.groupId,
                senderUserId: currentUserId,
                senderRole,
                profileId,
                text: data?.text,
                attachments: data?.attachments,
            });

            callback?.({ success: true, data: message });
        } catch (error: any) {
            emitError(socket, {
                code: error?.statusCode || 500,
                message: error?.message || 'Failed to send message',
                type: 'server',
            });
            callback?.({ success: false, message: error?.message });
        }
    });

    socket.on('group:delete-message', async ({ messageId }, callback) => {
        try {
            const message = await chatMessageServices.deleteChatMessage(
                messageId,
                currentUserId,
                profileId,
                role
            );
            callback?.({ success: true, data: message });
        } catch (error: any) {
            emitError(socket, {
                code: error?.statusCode || 500,
                message: error?.message || 'Failed to delete message',
                type: 'server',
            });
            callback?.({ success: false, message: error?.message });
        }
    });

    socket.on('group:typing', ({ groupId, name }) => {
        if (!groupId) return;
        socket.to(`group:${groupId}`).emit('group:typing', {
            groupId,
            userId: currentUserId,
            name,
        });
    });

    socket.on('group:stop-typing', ({ groupId }) => {
        if (!groupId) return;
        socket.to(`group:${groupId}`).emit('group:stop-typing', {
            groupId,
            userId: currentUserId,
        });
    });

    // ─── Direct (1:1) chat — client <-> worker only ────────────────────────

    socket.on('send-message', async (data, callback) => {
        try {
            if (role !== USER_ROLE.client && role !== USER_ROLE.worker) {
                throw new Error(
                    'Only a client or worker can start a direct chat'
                );
            }
            const otherProfileId = data?.receiver?.toString();
            if (!otherProfileId) {
                throw new Error('Receiver is required');
            }

            const clientId =
                role === USER_ROLE.client ? profileId : otherProfileId;
            const workerId =
                role === USER_ROLE.client ? otherProfileId : profileId;

            const chat = await chatServices.findOrCreateDirectChat(
                clientId,
                workerId
            );

            const message = await chatMessageServices.createChatMessage({
                chatId: chat._id.toString(),
                senderUserId: currentUserId,
                senderRole: role as TChatMessageSenderRole,
                profileId,
                text: data?.text,
                attachments: data?.attachments,
            });

            callback?.({ success: true, data: message });
        } catch (error: any) {
            emitError(socket, {
                code: error?.statusCode || 500,
                message: error?.message || 'Failed to send message',
                type: 'general',
                details: error?.message,
            });
            callback?.({ success: false, message: error?.message });
        }
    });

    socket.on('seen', async ({ chatId, conversationId }) => {
        try {
            const id = chatId || conversationId;
            if (!id) return;
            await chatMessageServices.markDirectChatSeen(id, currentUserId);
        } catch (error) {
            console.error('seen error:', error);
            emitError(socket, {
                code: 500,
                message: 'Failed to update seen status',
                type: 'server',
                details: 'Something went wrong while updating seen status',
            });
        }
    });
};

export default handleChat;
