import chatServices from '../chat/chat.services';

// Direct (1:1) chat list — thin wrapper so the existing /conversation route
// keeps working, backed by the unified Chat model (type: 'direct') instead
// of the old, broken Conversation model (which looked up nonexistent
// `customers`/`providers` collections).
const getConversation = async (
    profileId: string,
    role: string,
    query: Record<string, unknown>
) => {
    return chatServices.getMyDirectChatsFromDB(profileId, role, query);
};

export default { getConversation };
