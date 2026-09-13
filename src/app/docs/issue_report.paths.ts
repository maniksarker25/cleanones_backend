const issueReportPaths = {
    '/issue-report/create-issue-report': {
        post: {
            tags: ['Issue reports'],
            summary: 'Create issue report',
            operationId: 'postcreateissuereport',
            description:
                'Required role: worker. Location must exist and be active. isResolved defaults to false and cannot be supplied on creation.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['worker'],
            parameters: [],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/IssueReportCreate',
                        },
                    },
                },
            },
            responses: {
                '201': {
                    description: 'Create issue report successful.',
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
                                        $ref: '#/components/schemas/IssueReport',
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
                    description:
                        'Report, active location or authenticated profile not found.',
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
    '/issue-report/update-issue-report/{id}': {
        patch: {
            tags: ['Issue reports'],
            summary: 'Update issue report',
            operationId: 'patchupdateissuereportid',
            description:
                'Required role: manager. Supply at least one field. Managers may set isResolved. A supplied location must exist and be active.',
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
                            $ref: '#/components/schemas/IssueReportUpdate',
                        },
                    },
                },
            },
            responses: {
                '200': {
                    description: 'Update issue report successful.',
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
                                        $ref: '#/components/schemas/IssueReport',
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
                    description:
                        'Report, active location or authenticated profile not found.',
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
    '/issue-report/delete-issue-report/{id}': {
        delete: {
            tags: ['Issue reports'],
            summary: 'Delete issue report permanently',
            operationId: 'deletedeleteissuereportid',
            description: 'Required role: manager. Returns the deleted record.',
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
                    description: 'Delete issue report permanently successful.',
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
                                        $ref: '#/components/schemas/IssueReport',
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
                    description:
                        'Report, active location or authenticated profile not found.',
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
    '/issue-report/all-issue-reports': {
        get: {
            tags: ['Issue reports'],
            summary: 'List all issue reports',
            operationId: 'getallissuereports',
            description:
                'Required role: manager. Returns an array in data, newest first, without pagination.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            'x-roles': ['manager'],
            parameters: [],
            responses: {
                '200': {
                    description: 'List all issue reports successful.',
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
                                            $ref: '#/components/schemas/IssueReport',
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
                    description:
                        'Report, active location or authenticated profile not found.',
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
export default issueReportPaths;
