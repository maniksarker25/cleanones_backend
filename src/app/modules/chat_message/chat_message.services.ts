import httpStatus from 'http-status';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import { getIO } from '../../socket/socket';
import chatServices from '../chat/chat.services';
import { Chat } from '../chat/chat.model';
import { USER_ROLE } from '../user/user.constant';
import { TAttachment, TChatMessageSenderRole } from './chat_message.interface';
import { ChatMessage } from './chat_message.model';

const broadcastToChat = (
    chat: {
        _id: unknown;
        type: 'group' | 'direct' | 'worker' | 'client';
        client?: unknown | null;
        workers: unknown[];
    },
    event: string,
    payload: unknown
) => {
    try {
        const io = getIO();
        io.to(`group:${chat._id}`).emit(event, payload);
        // Group, worker<->managers and client<->managers chats broadcast to
        // every manager — a direct 1:1 chat between one client and one
        // worker is private and must not leak to the system-wide manager room.
        if (
            chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client'
        ) {
            io.to('role:manager').emit(event, payload);
        }
        // 'worker' chats have no client at all.
        if (chat.client) {
            io.to((chat.client as { toString(): string }).toString()).emit(
                event,
                payload
            );
        }
        chat.workers.forEach((workerId) => {
            io.to((workerId as { toString(): string }).toString()).emit(
                event,
                payload
            );
        });
    } catch {
        // Socket layer may not be initialized (e.g. tests) — REST reads remain
        // the source of truth regardless of whether the realtime nudge fires.
    }
};

const createChatMessage = async (params: {
    chatId: string;
    senderUserId: string;
    senderRole: TChatMessageSenderRole;
    profileId: string;
    text?: string;
    attachments?: TAttachment[];
}) => {
    const { chatId, senderUserId, senderRole, profileId, text, attachments } =
        params;

    const chat = await chatServices.ensureChatAccessOrThrow(
        chatId,
        profileId,
        senderRole
    );

    if (!chat.is_active) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This chat is no longer active'
        );
    }

    if (!text?.trim() && !attachments?.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Message must have text or at least one attachment'
        );
    }

    const message = await ChatMessage.create({
        chat: chatId,
        sender: senderUserId,
        sender_role: senderRole,
        text: text?.trim() || '',
        attachments: attachments || [],
    });

    await Chat.findByIdAndUpdate(chatId, {
        last_message: message._id,
        last_message_at: message.get('createdAt'),
    });

    const populated = await message.populate(
        'sender',
        'full_name profile_photo email'
    );

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
    ].filter(
        (id): id is string => !!id && id !== profileId
    );

    if (recipientProfileIds.length) {
        emitAppEvent('chat.message_received', {
            chatId: chatId,
            chatType: chat.type,
            senderUserId,
            recipientProfileIds,
            preview: populated.text?.trim()
                ? populated.text.slice(0, 120)
                : 'Sent an attachment',
        });
    }

    return populated;
};

const deleteChatMessage = async (
    messageId: string,
    userId: string,
    profileId: string,
    role: string
) => {
    const message = await ChatMessage.findById(messageId);
    if (!message) {
        throw new AppError(httpStatus.NOT_FOUND, 'Message not found');
    }

    const chat = await chatServices.ensureChatAccessOrThrow(
        message.chat.toString(),
        profileId,
        role
    );

    // message.sender stores the User id (not the Client/Worker/Manager
    // profile id), since sender identity is resolved via User for a name +
    // photo that works uniformly across all three roles — see the interface.
    // Manager moderation (delete-any) applies to group, worker<->managers and
    // client<->managers chats (managers are implicit members of all three); a
    // direct 1:1 chat has no manager involved at all.
    const isModerator =
        role === USER_ROLE.manager &&
        (chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client');
    const isSender = message.sender.toString() === userId;

    if (!isModerator && !isSender) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You can only delete your own message'
        );
    }

    message.is_deleted = true;
    message.deleted_at = new Date();
    await message.save();

    const event =
        chat.type === 'direct' ? 'message:deleted' : 'group:message-deleted';
    broadcastToChat(chat, event, { _id: message._id, chat: message.chat });

    return message;
};

const getChatMessagesFromDB = async (
    chatId: string,
    profileId: string,
    role: string,
    query: Record<string, unknown>
) => {
    await chatServices.ensureChatAccessOrThrow(chatId, profileId, role);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
        ChatMessage.find({ chat: chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'full_name profile_photo email'),
        ChatMessage.countDocuments({ chat: chatId }),
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
};

// ─── Direct-chat only: mark unseen messages from the other party as seen ───────

const markDirectChatSeen = async (chatId: string, viewerUserId: string) => {
    const result = await ChatMessage.updateMany(
        { chat: chatId, sender: { $ne: viewerUserId }, seen: false },
        { $set: { seen: true } }
    );

    if (result.modifiedCount === 0) return null;

    const chat = await Chat.findById(chatId).select('client workers type');
    if (!chat || chat.type !== 'direct' || !chat.client) return null;

    try {
        const io = getIO();
        io.to(chat.client.toString()).emit('message:seen', { chatId });
        chat.workers.forEach((workerId) => {
            io.to(workerId.toString()).emit('message:seen', { chatId });
        });
    } catch {
        // best-effort realtime nudge, see note above
    }

    return { modifiedCount: result.modifiedCount };
};

const chatMessageServices = {
    createChatMessage,
    deleteChatMessage,
    getChatMessagesFromDB,
    markDirectChatSeen,
};

export default chatMessageServices;
