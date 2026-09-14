const questionSuggestionPaths = {
    '/question-suggestion/create-question-suggestion': {
        post: {
            tags: ['Question suggestions'],
            summary: 'Create question suggestion',
            operationId: 'postcreatequestionsuggestion',
            description:
                'Manager only. Question and answer must be nonblank strings. Both fields are required.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager'],
            parameters: [],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                question: {
                                    type: 'string',
                                    minLength: 1,
                                    example: 'How do I request extra cleaning?',
                                },
                                answer: {
                                    type: 'string',
                                    minLength: 1,
                                    example:
                                        'Create an additional task for your cleaning plan.',
                                },
                            },
                            required: ['question', 'answer'],
                        },
                    },
                },
            },
            responses: {
                '201': {
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
                                            _id: {
                                                $ref: '#/components/schemas/ObjectId',
                                            },
                                            question: {
                                                type: 'string',
                                                minLength: 1,
                                                example:
                                                    'How do I request extra cleaning?',
                                            },
                                            answer: {
                                                type: 'string',
                                                minLength: 1,
                                                example:
                                                    'Create an additional task for your cleaning plan.',
                                            },
                                            createdAt: {
                                                type: 'string',
                                                format: 'date-time',
                                            },
                                            updatedAt: {
                                                type: 'string',
                                                format: 'date-time',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description: 'Invalid ID or model validation failure.',
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
                    description: 'Record or authenticated profile not found.',
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
                        'Server error; request validation failures currently return 500.',
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
    '/question-suggestion/update-question-suggestion/{id}': {
        patch: {
            tags: ['Question suggestions'],
            summary: 'Update question suggestion',
            operationId: 'patchupdatequestionsuggestionid',
            description:
                'Manager only. Question and answer must be nonblank strings. Supply at least one field.',
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
                            additionalProperties: false,
                            properties: {
                                question: {
                                    type: 'string',
                                    minLength: 1,
                                    example: 'How do I request extra cleaning?',
                                },
                                answer: {
                                    type: 'string',
                                    minLength: 1,
                                    example:
                                        'Create an additional task for your cleaning plan.',
                                },
                            },
                            minProperties: 1,
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
                                        type: 'object',
                                        properties: {
                                            _id: {
                                                $ref: '#/components/schemas/ObjectId',
                                            },
                                            question: {
                                                type: 'string',
                                                minLength: 1,
                                                example:
                                                    'How do I request extra cleaning?',
                                            },
                                            answer: {
                                                type: 'string',
                                                minLength: 1,
                                                example:
                                                    'Create an additional task for your cleaning plan.',
                                            },
                                            createdAt: {
                                                type: 'string',
                                                format: 'date-time',
                                            },
                                            updatedAt: {
                                                type: 'string',
                                                format: 'date-time',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description: 'Invalid ID or model validation failure.',
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
                    description: 'Record or authenticated profile not found.',
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
                        'Server error; request validation failures currently return 500.',
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
    '/question-suggestion/delete-question-suggestion/{id}': {
        delete: {
            tags: ['Question suggestions'],
            summary: 'Delete question suggestion',
            operationId: 'deletedeletequestionsuggestionid',
            description: 'Manager only. Permanently removes the record.',
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
                                            _id: {
                                                $ref: '#/components/schemas/ObjectId',
                                            },
                                            question: {
                                                type: 'string',
                                                minLength: 1,
                                                example:
                                                    'How do I request extra cleaning?',
                                            },
                                            answer: {
                                                type: 'string',
                                                minLength: 1,
                                                example:
                                                    'Create an additional task for your cleaning plan.',
                                            },
                                            createdAt: {
                                                type: 'string',
                                                format: 'date-time',
                                            },
                                            updatedAt: {
                                                type: 'string',
                                                format: 'date-time',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description: 'Invalid ID or model validation failure.',
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
                    description: 'Record or authenticated profile not found.',
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
                        'Server error; request validation failures currently return 500.',
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
    '/question-suggestion/all-question-suggestions': {
        get: {
            tags: ['Question suggestions'],
            summary: 'List all question suggestions',
            operationId: 'getallquestionsuggestions',
            description:
                'Public endpoint; no token required. Returns all records as an array in data, newest first, without pagination.',
            security: [],
            'x-roles': [],
            parameters: [],
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
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                _id: {
                                                    $ref: '#/components/schemas/ObjectId',
                                                },
                                                question: {
                                                    type: 'string',
                                                    minLength: 1,
                                                    example:
                                                        'How do I request extra cleaning?',
                                                },
                                                answer: {
                                                    type: 'string',
                                                    minLength: 1,
                                                    example:
                                                        'Create an additional task for your cleaning plan.',
                                                },
                                                createdAt: {
                                                    type: 'string',
                                                    format: 'date-time',
                                                },
                                                updatedAt: {
                                                    type: 'string',
                                                    format: 'date-time',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description: 'Invalid ID or model validation failure.',
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
                    description: 'Record or authenticated profile not found.',
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
                        'Server error; request validation failures currently return 500.',
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
export default questionSuggestionPaths;
