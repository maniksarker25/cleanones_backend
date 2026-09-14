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
        description: "Account is blocked or inactive, or the caller is not a member of this chat.",
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

const chatPaths = {
    '/chat/my-chats': {
        get: {
            tags: ['Chats'],
            summary: "List the caller's chats (group, direct, worker and client, unified)",
            operationId: 'getChatMyChats',
            description:
                "One unified, sorted list covering all four chat types — group chats (one per CleaningPlan), direct (1:1) client↔worker chats, worker↔managers chats (one per worker, auto-created with the worker profile), and client↔managers chats (one per client, auto-created with the client profile) — no separate endpoint per chat type. This is a single query, not several merged in application code: Chat stores all four types in one collection with shared client/workers fields, so filtering by membership alone naturally returns whichever apply. A manager sees every active group, worker and client chat (never direct chats — those are private between a client and a worker, and managers are not implicit members of them). A client sees every active chat where they are the client (group, direct, and their own client chat). A worker sees every active chat where they are in workers (group, direct, and their own worker chat). Sorted by last_message_at desc (then created_at desc). client, workers (with each worker's own name and linked user full_name/profile_photo) and last_message (with its own sender) are populated. Use type to distinguish entries, and display_name (computed per-viewer, not stored) to show a name for any of the four types — e.g. a worker viewing their worker chat sees 'Managers', a manager viewing it sees the worker's name; a client viewing their client chat sees 'Manager', a manager viewing it sees the client's name.\n\nRequired role: manager, client, worker.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
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
                                                items: { $ref: '#/components/schemas/Chat' },
                                                description: 'All four chat types interleaved by recency, not grouped by type.',
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
    '/chat/{id}/members': {
        get: {
            tags: ['Chats'],
            summary: 'Get chat members',
            operationId: 'getChatIdMembers',
            description:
                'A manager may view any group, worker or client chat\'s members without being an explicit member (all three are implicitly manager-visible); for every other case (a direct chat, or a client/worker caller) the caller must actually be the chat\'s client or in its workers — 403 otherwise. client and workers are populated (workers\' own name and linked user full_name/profile_photo included).\n\nRequired role: manager, client, worker.',
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    description: 'Chat identifier.',
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
                                    data: {
                                        type: 'object',
                                        properties: {
                                            client: {
                                                type: 'object',
                                                properties: {
                                                    _id: { $ref: '#/components/schemas/ObjectId' },
                                                    name: { type: 'string' },
                                                    email: { type: 'string', format: 'email' },
                                                    phone: { type: 'string' },
                                                },
                                            },
                                            workers: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        _id: { $ref: '#/components/schemas/ObjectId' },
                                                        name: { type: 'string' },
                                                        email: { type: 'string', format: 'email' },
                                                        phone: { type: 'string' },
                                                        worker_type: { type: 'string' },
                                                        user: {
                                                            type: 'object',
                                                            properties: {
                                                                full_name: { type: 'string' },
                                                                profile_photo: { type: 'string', nullable: true },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            managers: {
                                                type: 'string',
                                                enum: ['all'],
                                                nullable: true,
                                                description:
                                                    "Only present (always 'all') when the chat's type is 'group', 'worker' or 'client' — every manager is implicitly a member of all three. Absent for direct chats.",
                                            },
                                            display_name: {
                                                type: 'string',
                                                nullable: true,
                                                description:
                                                    "Computed per-viewer, not stored. See the Chat schema's display_name for the rule.",
                                            },
                                        },
                                        required: ['client', 'workers'],
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
    '/chat/{id}/rename': {
        patch: {
            tags: ['Chats'],
            summary: 'Rename a group chat',
            operationId: 'patchChatIdRename',
            description:
                "Group chats only — 400 for every other type (none of 'direct', 'worker' or 'client' has a single stored name to rename; worker/client chat names are always computed per-viewer, see the Chat schema's display_name). Emits the group:renamed Socket.IO event (see docs/CHAT_SOCKET_EVENTS.md) to the chat room, the role:manager room, the client's room and every worker's room; the socket push is best-effort and does not affect the HTTP response.\n\nRequired role: manager.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    description: 'Chat identifier.',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', minLength: 1, example: 'Downtown Office Cleaning' },
                            },
                            required: ['name'],
                        },
                    },
                },
            },
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
                                    data: { $ref: '#/components/schemas/Chat' },
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

export default chatPaths;
