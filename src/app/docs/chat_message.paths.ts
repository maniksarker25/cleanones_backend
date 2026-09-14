const errors = {
    '400': {
        description: 'Invalid ID, model validation, or business rule failure.',
        content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
    },
    '401': {
        description: 'Missing, invalid, expired token, or role not allowed.',
        content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
    },
    '403': {
        description: 'Account is blocked or inactive, the caller is not a member of this chat, or (delete only) not the message sender.',
        content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
    },
    '404': {
        description: 'Chat, message or authenticated profile not found.',
        content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
    },
    '429': {
        description: 'Rate limit exceeded.',
        content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
    },
    '500': {
        description: 'Server error.',
        content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
        },
    },
};

const chatMessagePaths = {
    '/chat-message/{chatId}': {
        get: {
            tags: ['Chat messages'],
            summary: 'List messages in a chat',
            operationId: 'getChatMessageChatId',
            description:
                'The caller must be a member of the chat (manager auto-passes for group chats; otherwise the caller must be the chat\'s client or in its workers) — 403 otherwise. Internally queried newest-first for correct pagination, then reversed before returning, so data.result is in chronological (oldest-first) order. sender is populated (full_name/profile_photo/email). There is no REST endpoint to create a message — messages are only created via Socket.IO; see docs/CHAT_SOCKET_EVENTS.md.\n\nRequired role: manager, client, worker.',
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'chatId',
                    in: 'path',
                    required: true,
                    description: 'Chat identifier.',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                },
                {
                    name: 'page',
                    in: 'query',
                    schema: { type: 'integer', default: 1 },
                    description: 'Use a positive page number.',
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 20 },
                    description: 'Use a positive page size.',
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            meta: { $ref: '#/components/schemas/Pagination' },
                                            result: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/ChatMessage' },
                                                description: 'Chronological (oldest first).',
                                            },
                                        },
                                        required: ['meta', 'result'],
                                    },
                                },
                                required: ['success', 'message'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat-message/{id}': {
        delete: {
            tags: ['Chat messages'],
            summary: 'Delete a chat message (soft delete)',
            operationId: 'deleteChatMessageId',
            description:
                'Soft delete only — sets is_deleted: true and deleted_at, the document is never actually removed. Allowed for the original sender (matched against the User account id, not the profile id), or for a manager on a group chat (moderator override; managers cannot delete direct-chat messages they did not send) — 403 otherwise. Emits group:message-deleted (group chats, includes the role:manager room) or message:deleted (direct chats, excludes it) over Socket.IO; see docs/CHAT_SOCKET_EVENTS.md. The socket push is best-effort and does not affect the HTTP response.\n\nRequired role: manager, client, worker.',
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    description: 'Message identifier.',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string' },
                                    data: { $ref: '#/components/schemas/ChatMessage' },
                                },
                                required: ['success', 'message'],
                            },
                        },
                    },
                },
            },
        },
    },
};

export default chatMessagePaths;
