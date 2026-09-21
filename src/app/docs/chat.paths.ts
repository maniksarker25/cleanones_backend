const chatPaths = {
    '/chat/my-groups': {
        get: {
            tags: ['Chat'],
            summary: 'List my group chats',
            operationId: 'getchatmygroups',
            description:
                'Active groups only. Managers see all groups; clients and workers see their memberships. Ordered by last_message_at then createdAt descending. Client and last_message.sender are populated.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'page',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                    },
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 10,
                    },
                },
            ],
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            meta: {
                                                $ref: '#/components/schemas/Pagination',
                                            },
                                            result: {
                                                type: 'array',
                                                items: {
                                                    $ref: '#/components/schemas/ChatRecord',
                                                },
                                            },
                                        },
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, model validation or business rule failure.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '403': {
                    description: 'Not a chat member or deletion not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description:
                        'Chat, message or authenticated profile not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat/my-direct-chats': {
        get: {
            tags: ['Chat'],
            summary: 'List my direct chats',
            operationId: 'getchatmydirectchats',
            description:
                'Client-worker direct chats only. Managers have no access. Populates client, workers.user and last_message.sender. Ordered by last_message_at then createdAt descending.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['client', 'worker'],
            parameters: [
                {
                    name: 'page',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                    },
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 20,
                    },
                },
            ],
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            meta: {
                                                $ref: '#/components/schemas/Pagination',
                                            },
                                            result: {
                                                type: 'array',
                                                items: {
                                                    $ref: '#/components/schemas/ChatRecord',
                                                },
                                            },
                                        },
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, model validation or business rule failure.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '403': {
                    description: 'Not a chat member or deletion not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description:
                        'Chat, message or authenticated profile not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat/{id}/members': {
        get: {
            tags: ['Chat'],
            summary: 'Get chat members',
            operationId: 'getchatidmembers',
            description:
                'Membership required; managers may access any group, but not direct chats. Works for group and direct chats. managers is "all" for groups and omitted for direct chats.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                },
            ],
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            client: {
                                                $ref: '#/components/schemas/ChatClient',
                                            },
                                            workers: {
                                                type: 'array',
                                                items: {
                                                    $ref: '#/components/schemas/ChatWorker',
                                                },
                                            },
                                            managers: {
                                                type: 'string',
                                                enum: ['all'],
                                            },
                                        },
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, model validation or business rule failure.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '403': {
                    description: 'Not a chat member or deletion not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description:
                        'Chat, message or authenticated profile not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat/{id}/rename': {
        patch: {
            tags: ['Chat'],
            summary: 'Rename group chat',
            operationId: 'patchchatidrename',
            description:
                'Group chats only. Updates last_updated_by and emits group:renamed. Returns the chat with unpopulated references.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    minLength: 1,
                                    example: 'Office cleaning team',
                                },
                            },
                            required: ['name'],
                        },
                    },
                },
            },
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ChatRecord',
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, model validation or business rule failure.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '403': {
                    description: 'Not a chat member or deletion not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description:
                        'Chat, message or authenticated profile not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat/{id}/members/{workerId}': {
        delete: {
            tags: ['Chat'],
            summary: 'Remove a worker from a group chat',
            operationId: 'deletechatidmembersworkerId',
            description:
                'Manager only. Group chats only — returns 400 for direct/worker/client chats. Returns 400 if the worker is not currently a member. Pulls the worker from the workers array, updates last_updated_by, and emits group:removed to the removed worker (same event/shape as a shift reassignment dropping them) and group:member-removed to the group room, remaining workers, the client and role:manager. Membership only changes here — the worker keeps access to any due/completed work already on their record.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                    description: 'The group chat id.',
                },
                {
                    name: 'workerId',
                    in: 'path',
                    required: true,
                    schema: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                    description: 'The worker to remove from the group.',
                },
            ],
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ChatRecord',
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, not a group chat, or worker is not a member.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description: 'Chat not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat-message/{chatId}': {
        get: {
            tags: ['Chat'],
            summary: 'Get chat messages',
            operationId: 'getchatmessagechatId',
            description:
                'Membership required; managers may read group chats only. Selects newest messages first, then reverses each page for chronological display. Includes soft-deleted records: clients should render a deleted placeholder when is_deleted is true; stored text and attachments are not erased.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'chatId',
                    in: 'path',
                    required: true,
                    schema: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                },
                {
                    name: 'page',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                    },
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 20,
                    },
                },
            ],
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            meta: {
                                                $ref: '#/components/schemas/Pagination',
                                            },
                                            result: {
                                                type: 'array',
                                                items: {
                                                    $ref: '#/components/schemas/ChatMessage',
                                                },
                                            },
                                        },
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, model validation or business rule failure.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '403': {
                    description: 'Not a chat member or deletion not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description:
                        'Chat, message or authenticated profile not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
    '/chat-message/{id}': {
        delete: {
            tags: ['Chat'],
            summary: 'Delete chat message',
            operationId: 'deletechatmessageid',
            description:
                'Soft delete. Senders may delete their own messages; managers may delete any message in groups only. Returns the message with is_deleted=true and deleted_at set, and emits group:message-deleted or message:deleted.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager', 'client', 'worker'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                },
            ],
            responses: {
                '200': {
                    description: 'Successful request.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ChatMessage',
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid ID, model validation or business rule failure.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '401': {
                    description:
                        'Missing or invalid token, or role not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '403': {
                    description: 'Not a chat member or deletion not allowed.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description:
                        'Chat, message or authenticated profile not found.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '429': {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '500': {
                    description:
                        'Server error; request validation may return 500.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
            },
        },
    },
};
export default chatPaths;
