/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server as IOServer, Socket } from 'socket.io';
import Conversation from '../modules/conversation/conversation.model';
import Message from '../modules/message/message.model';
import { USER_ROLE } from '../modules/user/user.constant';
import { emitError } from './helper';

const handleChat = async (
    io: IOServer,
    socket: Socket,
    currentUserId: string,
    role: string
): Promise<void> => {
    socket.on('send-message', async (data, callback) => {
        try {
            const receiverId = data?.receiver?.toString();

            if (!receiverId) {
                emitError(socket, {
                    code: 400,
                    message: 'Receiver is required',
                    type: 'general',
                    details: 'You must provide receiverId',
                });
                return;
            }

            const senderModel =
                role === USER_ROLE.client ? 'Client' : 'Worker';

            const receiverModel =
                role === USER_ROLE.client ? 'Worker' : 'Client';

            const participantsModel =
                role === USER_ROLE.client
                    ? ['Client', 'Worker']
                    : ['Worker', 'Client'];

            const participantKey = [currentUserId.toString(), receiverId]
                .sort()
                .join(':');

            const conversation = await Conversation.findOneAndUpdate(
                { participantKey },
                {
                    $setOnInsert: {
                        participants: [currentUserId, receiverId],
                        participantsModel,
                        participantKey,
                    },
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );

            const saveMessage = await Message.create({
                text: data.text || '',
                imageUrl: data.imageUrl || [],
                videoUrl: data.videoUrl || [],
                pdfUrl: data.pdfUrl || [],
                msgByUserId: currentUserId,
                msgByUserModel: senderModel,
                receiverId,
                receiverModel,
                conversationId: conversation._id,
            });

            const [populatedMessage] = await Promise.all([
                saveMessage.populate({
                    path: 'msgByUserId',
                    select: 'name profile_image',
                }),

                Conversation.updateOne(
                    { _id: conversation._id },
                    {
                        $set: {
                            lastMessage: saveMessage._id,
                            lastMessageAt: new Date(),
                        },
                    }
                ),
            ]);

            // Use one event name. Easier for frontend and less confusing.
            io.to(currentUserId.toString())
                .to(receiverId)
                .emit('message:new', populatedMessage);

            io.to(currentUserId.toString()).emit('conversation:update', {
                conversationId: conversation._id,
                lastMessage: populatedMessage,
                unreadDelta: 0,
            });

            io.to(receiverId).emit('conversation:update', {
                conversationId: conversation._id,
                lastMessage: populatedMessage,
                unreadDelta: 1,
            });

            callback?.({
                success: true,
                data: populatedMessage,
            });
        } catch (error) {
            console.error('send-message error:', error);

            emitError(socket, {
                code: 500,
                message: 'Failed to send message',
                type: 'server',
                details: 'Something went wrong while sending message',
            });

            callback?.({
                success: false,
                message: 'Failed to send message',
            });
        }
    });

    // seen ---------------------------------
    socket.on('seen', async ({ conversationId }) => {
        try {
            const result = await Message.updateMany(
                {
                    conversationId,
                    receiverId: currentUserId,
                    seen: false,
                },
                {
                    $set: {
                        seen: true,
                    },
                }
            );

            if (result.modifiedCount === 0) return;

            const conversation = await Conversation.findById(conversationId)
                .select('participants')
                .lean();

            if (!conversation) return;

            const otherUserId = conversation.participants.find(
                (participant: any) =>
                    participant.toString() !== currentUserId.toString()
            );

            socket.emit('conversation:seen', {
                conversationId,
                unreadCount: 0,
            });

            if (otherUserId) {
                io.to(otherUserId.toString()).emit('message:seen', {
                    conversationId,
                    seenBy: currentUserId,
                });
            }
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
