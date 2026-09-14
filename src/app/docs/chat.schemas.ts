const chatSchemas = {
    ChatAttachment: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                example: 'https://example.com/photo.jpg',
            },
            type: {
                type: 'string',
                enum: ['image', 'video', 'pdf', 'file'],
            },
        },
        required: ['url', 'type'],
    },
    ChatSender: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            full_name: {
                type: 'string',
            },
            profile_photo: {
                type: 'string',
                nullable: true,
            },
            email: {
                type: 'string',
            },
        },
    },
    ChatMessage: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            chat: {
                $ref: '#/components/schemas/ObjectId',
            },
            sender: {
                oneOf: [
                    {
                        $ref: '#/components/schemas/ObjectId',
                    },
                    {
                        $ref: '#/components/schemas/ChatSender',
                    },
                ],
            },
            sender_role: {
                type: 'string',
                enum: ['client', 'worker', 'manager'],
            },
            text: {
                type: 'string',
            },
            attachments: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/ChatAttachment',
                },
            },
            seen: {
                type: 'boolean',
            },
            is_deleted: {
                type: 'boolean',
            },
            deleted_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            created_at: {
                type: 'string',
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
            },
        },
    },
    ChatClient: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
            },
            email: {
                type: 'string',
            },
            phone: {
                type: 'string',
            },
        },
    },
    ChatWorker: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            email: {
                type: 'string',
            },
            phone: {
                type: 'string',
            },
            worker_type: {
                type: 'string',
            },
            user: {
                type: 'object',
                properties: {
                    _id: {
                        $ref: '#/components/schemas/ObjectId',
                    },
                    full_name: {
                        type: 'string',
                    },
                    profile_photo: {
                        type: 'string',
                        nullable: true,
                    },
                },
            },
        },
    },
    ChatRecord: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            type: {
                type: 'string',
                enum: ['group', 'direct'],
            },
            cleaning_plan: {
                type: 'string',
                nullable: true,
            },
            name: {
                type: 'string',
                nullable: true,
            },
            client: {
                oneOf: [
                    {
                        $ref: '#/components/schemas/ObjectId',
                    },
                    {
                        $ref: '#/components/schemas/ChatClient',
                    },
                ],
            },
            workers: {
                type: 'array',
                items: {
                    oneOf: [
                        {
                            $ref: '#/components/schemas/ObjectId',
                        },
                        {
                            $ref: '#/components/schemas/ChatWorker',
                        },
                    ],
                },
            },
            last_message: {
                nullable: true,
                oneOf: [
                    {
                        $ref: '#/components/schemas/ObjectId',
                    },
                    {
                        $ref: '#/components/schemas/ChatMessage',
                    },
                ],
            },
            last_message_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            last_updated_by: {
                type: 'string',
                nullable: true,
            },
            participant_key: {
                type: 'string',
                nullable: true,
            },
            is_active: {
                type: 'boolean',
            },
            created_at: {
                type: 'string',
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
            },
        },
    },
};
export default chatSchemas;
