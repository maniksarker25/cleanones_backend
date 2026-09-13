import chatMessageServices from '../chat_message/chat_message.services';

// Thin wrapper so the existing /message route keeps working, backed by the
// unified ChatMessage model instead of the old, broken Message model (which
// looked up nonexistent `customers`/`providers` collections).
const getMessagesByConversationId = async (
    profileId: string,
    role: string,
    chatId: string,
    query: Record<string, unknown>
) => {
    return chatMessageServices.getChatMessagesFromDB(
        chatId,
        profileId,
        role,
        query
    );
};

const MessageService = {
    getMessagesByConversationId,
};

export default MessageService;
