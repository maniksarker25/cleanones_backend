const clientContactPaths = {
    '/client-contact/create-client-contact': {
        post: {
            tags: ['Client contacts'],
            summary: 'Create client contact',
            operationId: 'postcreateclientcontact',
            description:
                'Creates a contact. Client, name, role, phone and email are required. Client must reference an existing, non-deleted client.\n\nRequired role: manager.',
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
                            $ref: '#/components/schemas/ClientContactCreate',
                        },
                    },
                },
            },
            responses: {
                '201': {
                    description: 'Create client contact successful.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['success', 'message', 'data'],
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ClientContact',
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid contact ID or model validation failure.',
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
                    description: 'Inactive account.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description: 'Contact or authenticated profile not found.',
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
                        'Server error. Zod request validation failures currently return HTTP 500.',
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
    '/client-contact/update-client-contact/{id}': {
        patch: {
            tags: ['Client contacts'],
            summary: 'Update client contact',
            operationId: 'patchupdateclientcontactid',
            description:
                'Updates only supplied fields. At least one field is required. If supplied, client must reference an existing, non-deleted client.\n\nRequired role: manager.',
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
                            $ref: '#/components/schemas/ClientContactUpdate',
                        },
                    },
                },
            },
            responses: {
                '200': {
                    description: 'Update client contact successful.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['success', 'message', 'data'],
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ClientContact',
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid contact ID or model validation failure.',
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
                    description: 'Inactive account.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description: 'Contact or authenticated profile not found.',
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
                        'Server error. Zod request validation failures currently return HTTP 500.',
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
    '/client-contact/delete-client-contact/{id}': {
        delete: {
            tags: ['Client contacts'],
            summary: 'Delete client contact',
            operationId: 'deletedeleteclientcontactid',
            description:
                'Permanently deletes the contact and returns the deleted record.\n\nRequired role: manager.',
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
                    description: 'Delete client contact successful.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['success', 'message', 'data'],
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ClientContact',
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid contact ID or model validation failure.',
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
                    description: 'Inactive account.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description: 'Contact or authenticated profile not found.',
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
                        'Server error. Zod request validation failures currently return HTTP 500.',
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
    '/client-contact/all-client-contacts': {
        get: {
            tags: ['Client contacts'],
            summary: 'List client contacts',
            operationId: 'getallclientcontacts',
            description:
                'Returns all contacts as an array in data, newest first. No pagination or filtering.\n\nRequired role: manager.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager'],
            parameters: [],
            responses: {
                '200': {
                    description: 'List client contacts successful.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['success', 'message', 'data'],
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
                                            $ref: '#/components/schemas/ClientContact',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid contact ID or model validation failure.',
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
                    description: 'Inactive account.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description: 'Contact or authenticated profile not found.',
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
                        'Server error. Zod request validation failures currently return HTTP 500.',
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
    '/client-contact/single-client-contact/{id}': {
        get: {
            tags: ['Client contacts'],
            summary: 'Get client contact',
            operationId: 'getsingleclientcontactid',
            description:
                'Returns one contact by ID.\n\nRequired role: manager.',
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
                    description: 'Get client contact successful.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['success', 'message', 'data'],
                                properties: {
                                    success: {
                                        type: 'boolean',
                                        enum: [true],
                                    },
                                    message: {
                                        type: 'string',
                                    },
                                    data: {
                                        $ref: '#/components/schemas/ClientContact',
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description:
                        'Invalid contact ID or model validation failure.',
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
                    description: 'Inactive account.',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                        },
                    },
                },
                '404': {
                    description: 'Contact or authenticated profile not found.',
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
                        'Server error. Zod request validation failures currently return HTTP 500.',
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

export default clientContactPaths;
