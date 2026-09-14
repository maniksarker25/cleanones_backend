import chatServices from '../chat/chat.services';

// Thin wrapper so the existing /conversation route keeps working, backed by
// the unified Chat model instead of the old, broken Conversation model
// (which looked up nonexistent `customers`/`providers` collections). Now
// delegates to the same unified group+direct list as GET /chat/my-chats —
// see chat.services.ts's getMyChatsFromDB for why a single query covers both.
const getConversation = async (
    profileId: string,
    role: string,
    query: Record<string, unknown>
) => {
    return chatServices.getMyChatsFromDB(profileId, role, query);
};

export default { getConversation };
