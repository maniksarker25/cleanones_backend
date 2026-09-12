import Conversation from '../modules/conversation/conversation.model';
import Message from '../modules/message/message.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getSingleConversation = async (
    conversationId: any,
    currentUserId: string
) => {
    const conversation = await Conversation.findById(conversationId)
        .sort({ updatedAt: -1 })
        .populate({
            path: 'participants',
            select: 'name profile_image _id ',
        })
        .populate({ path: 'lastMessage', model: 'Message' });

    if (!conversation) return null;
    const countUnseenMessage = await Message.countDocuments({
        conversationId: conversation._id,
        msgByUserId: { $ne: currentUserId },
        seen: false,
    });

    const otherUser: any = conversation.participants.find(
        (participant: any) => participant._id.toString() !== currentUserId
    );

    return {
        _id: conversation._id,
        userData: {
            _id: otherUser?._id,
            name: otherUser?.name,
            email: otherUser?.email,
            profileImage: otherUser?.profile_image,
        },
        unseenMsg: countUnseenMessage,
        lastMessage: conversation.lastMessage,
    };
};
