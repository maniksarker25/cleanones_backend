// Socket.IO isn't representable as OpenAPI paths, so this is exposed as the
// `x-socket-events` vendor extension on the root document (visible in the
// raw /api-docs.json; Swagger UI itself won't render it). The full, prose
// reference — connection/auth handshake, rooms, and worked examples — lives
// in docs/CHAT_SOCKET_EVENTS.md; this is the structured/machine-readable
// summary of the same contract.

// Renders the events above as a Markdown table, for embedding into
// info.description — the one part of an OpenAPI document Swagger UI actually
// renders as formatted text, unlike root-level `x-` extensions. Built from
// the same array so the visible docs and the machine-readable `x-socket-events`
// extension can never drift apart.
export function renderChatSocketEventsMarkdown(): string {
    const rows = chatSocketEvents.events
        .map((e) => {
            const payload =
                typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload);
            const extra = 'broadcast' in e && e.broadcast ? ` _(→ ${e.broadcast})_` : '';
            const desc = 'description' in e && e.description ? e.description : '';
            return `| \`${e.name}\` | ${e.direction} | ${payload.replace(/\|/g, '\\|')} | ${(desc + extra).replace(/\|/g, '\\|')} |`;
        })
        .join('\n');

    return [
        `${chatSocketEvents.description}`,
        '',
        '| Event | Direction | Payload | Notes |',
        '| --- | --- | --- | --- |',
        rows,
        '',
        'Full prose reference (rooms, auth handshake, worked examples): `docs/CHAT_SOCKET_EVENTS.md`.',
    ].join('\n');
}

const chatSocketEvents = {
    description:
        'Chat messages are created only over Socket.IO (default path /socket.io, default namespace). Auth: pass the access token as socket.handshake.auth.token or ?token= query param; the server verifies it like REST and disconnects the socket immediately on failure. See docs/CHAT_SOCKET_EVENTS.md for the full reference (rooms, worked examples, edge cases).',
    events: [
        {
            name: 'group:join',
            direction: 'client-to-server',
            payload: { groupId: 'string (Chat _id, any of the four chat types)' },
            description:
                "Joins room group:<groupId> after the same access check as REST (manager auto-passes for group, worker and client chats; otherwise caller must be the chat's client or in its workers). No ack; failure emits socket-error.",
        },
        {
            name: 'group:leave',
            direction: 'client-to-server',
            payload: { groupId: 'string' },
            description: 'Leaves room group:<groupId>. No ack, no error on missing groupId.',
        },
        {
            name: 'group:send-message',
            direction: 'client-to-server',
            payload: {
                groupId: 'string',
                text: 'string (optional; text or attachments required)',
                attachments: "{ url: string, type: 'image'|'video'|'pdf'|'file' }[] (optional)",
            },
            ack: '{ success: true, data: ChatMessage } | { success: false, message: string }',
            description:
                'Sends a message into any chat (group, direct, worker, or client) the caller is a member of. Triggers group:new-message (group/worker/client) or message:new (direct) on success.',
        },
        {
            name: 'group:delete-message',
            direction: 'client-to-server',
            payload: { messageId: 'string' },
            ack: '{ success: true, data: ChatMessage } | { success: false, message: string }',
            description:
                'Soft-deletes a message (sender, or manager-on-group/worker/client-chat only). Triggers group:message-deleted (group/worker/client) or message:deleted (direct) on success.',
        },
        {
            name: 'group:typing',
            direction: 'client-to-server',
            payload: { groupId: 'string', name: 'string' },
            description: 'No ack. Relayed to the rest of group:<groupId> as server-to-client group:typing.',
        },
        {
            name: 'group:stop-typing',
            direction: 'client-to-server',
            payload: { groupId: 'string' },
            description: 'No ack. Relayed to the rest of group:<groupId> as server-to-client group:stop-typing.',
        },
        {
            name: 'send-message',
            direction: 'client-to-server',
            payload: {
                receiver: "string (the other party's profileId)",
                text: 'string (optional; text or attachments required)',
                attachments: "{ url: string, type: 'image'|'video'|'pdf'|'file' }[] (optional)",
            },
            ack: '{ success: true, data: ChatMessage } | { success: false, message: string }',
            description:
                'Client/worker only. Finds-or-creates the direct chat with `receiver`, then sends the message. Triggers message:new on success.',
        },
        {
            name: 'seen',
            direction: 'client-to-server',
            payload: { chatId: 'string (or conversationId as an alias)' },
            description:
                'Direct chats only (no-op for group chats). Marks every unread message from the other party as seen. Triggers message:seen if any were updated.',
        },
        {
            name: 'onlineUser',
            direction: 'server-to-client',
            broadcast: 'everyone (io.emit)',
            payload: 'string[] (currently online profileIds; in-memory, resets on server restart)',
            description: 'Sent on every connect/disconnect.',
        },
        {
            name: 'socket-error',
            direction: 'server-to-client',
            broadcast: 'the offending socket only',
            payload: {
                code: 'number',
                message: 'string',
                type: "'validation' | 'database' | 'auth' | 'general' | 'server'",
                details: 'unknown (optional)',
            },
        },
        {
            name: 'group:new-message',
            direction: 'server-to-client',
            broadcast: "group:<chatId>, role:manager, the chat's client room (if any), every worker's room",
            payload: 'ChatMessage (sender populated)',
            description: 'A message was created in a group, worker, or client chat.',
        },
        {
            name: 'message:new',
            direction: 'server-to-client',
            broadcast: "group:<chatId>, the client's room, the worker's room (excludes role:manager)",
            payload: 'ChatMessage (sender populated)',
            description: 'A message was created in a direct chat.',
        },
        {
            name: 'group:message-deleted',
            direction: 'server-to-client',
            broadcast: 'same targets as group:new-message',
            payload: { _id: 'string', chat: 'string' },
        },
        {
            name: 'message:deleted',
            direction: 'server-to-client',
            broadcast: 'same targets as message:new',
            payload: { _id: 'string', chat: 'string' },
        },
        {
            name: 'message:seen',
            direction: 'server-to-client',
            broadcast: "the chat's client room and the worker's room",
            payload: { chatId: 'string' },
        },
        {
            name: 'group:typing',
            direction: 'server-to-client',
            broadcast: 'everyone else in group:<groupId>',
            payload: { groupId: 'string', userId: 'string (User account id)', name: 'string (optional)' },
        },
        {
            name: 'group:stop-typing',
            direction: 'server-to-client',
            broadcast: 'everyone else in group:<groupId>',
            payload: { groupId: 'string', userId: 'string (User account id)' },
        },
        {
            name: 'group:added',
            direction: 'server-to-client',
            broadcast: 'the newly-added worker only',
            payload: { _id: 'string', name: 'string | null', cleaning_plan: 'string | null' },
            description: 'Fired from the cleaning-plan worker-assignment flow, not from a client-sent event.',
        },
        {
            name: 'group:removed',
            direction: 'server-to-client',
            broadcast: 'the removed worker only',
            payload: { _id: 'string', cleaning_plan: 'string | null' },
        },
        {
            name: 'group:renamed',
            direction: 'server-to-client',
            broadcast: "group:<chatId>, role:manager, the client's room, every worker's room",
            payload: { _id: 'string', name: 'string' },
            description: 'Fired from PATCH /chat/{id}/rename, not from a client-sent socket event.',
        },
        {
            name: 'worker-chat:created',
            direction: 'server-to-client',
            broadcast: 'role:manager',
            payload: { _id: 'string', worker: 'string' },
            description:
                "Fired when a worker's chat with managers is created (right after the worker profile is created via POST /worker/create-worker). Lets already-connected managers refresh their chat list live instead of polling.",
        },
        {
            name: 'client-chat:created',
            direction: 'server-to-client',
            broadcast: 'role:manager',
            payload: { _id: 'string', client: 'string' },
            description:
                "Fired when a client's chat with managers is created (right after the client profile is created via POST /client/create-client). Mirrors worker-chat:created.",
        },
    ],
};

export default chatSocketEvents;
