// Shared OpenAPI 3.0 schemas. Keep in sync with validation, models and services.
const schemas = {
    "IssueReportCreate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
            "issueType",
            "severity",
            "location",
            "description"
        ],
        "properties": {
            "issueType": {
                "type": "string",
                "minLength": 1,
                "example": "Damaged equipment"
            },
            "severity": {
                "type": "string",
                "enum": [
                    "Low",
                    "Medium",
                    "High"
                ]
            },
            "location": {
                "$ref": "#/components/schemas/ObjectId"
            },
            "description": {
                "type": "string",
                "minLength": 1,
                "example": "The floor scrubber is leaking."
            }
        }
    },
    "IssueReportUpdate": {
        "type": "object",
        "additionalProperties": false,
        "minProperties": 1,
        "properties": {
            "issueType": {
                "type": "string",
                "minLength": 1,
                "example": "Damaged equipment"
            },
            "severity": {
                "type": "string",
                "enum": [
                    "Low",
                    "Medium",
                    "High"
                ]
            },
            "location": {
                "$ref": "#/components/schemas/ObjectId"
            },
            "description": {
                "type": "string",
                "minLength": 1,
                "example": "The floor scrubber is leaking."
            },
            "isResolved": {
                "type": "boolean"
            }
        }
    },
    "IssueReport": {
        "type": "object",
        "properties": {
            "_id": {
                "$ref": "#/components/schemas/ObjectId"
            },
            "issueType": {
                "type": "string",
                "minLength": 1,
                "example": "Damaged equipment"
            },
            "severity": {
                "type": "string",
                "enum": [
                    "Low",
                    "Medium",
                    "High"
                ]
            },
            "location": {
                "$ref": "#/components/schemas/ObjectId"
            },
            "description": {
                "type": "string",
                "minLength": 1,
                "example": "The floor scrubber is leaking."
            },
            "isResolved": {
                "type": "boolean",
                "default": false
            },
            "createdAt": {
                "type": "string",
                "format": "date-time"
            },
            "updatedAt": {
                "type": "string",
                "format": "date-time"
            }
        }
    },
    ClientContactCreate: {
        type: 'object',
        additionalProperties: false,
        required: ['client', 'name', 'role', 'phone', 'email'],
        properties: {
            client: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Alex Smith',
                description: 'Trimmed; must not be blank.',
            },
            role: {
                type: 'string',
                minLength: 1,
                example: 'Site supervisor',
                description:
                    'Free-text contact role; not an account authorization role.',
            },
            email: {
                type: 'string',
                format: 'email',
                example: 'alex@example.com',
                description: 'Trimmed valid email address.',
            },
            phone: {
                type: 'string',
                minLength: 1,
                example: '+8801712345678',
                description: 'Trimmed; must not be blank.',
            },
        },
    },
    ClientContactUpdate: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
            client: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Alex Smith',
                description: 'Trimmed; must not be blank.',
            },
            role: {
                type: 'string',
                minLength: 1,
                example: 'Site supervisor',
                description:
                    'Free-text contact role; not an account authorization role.',
            },
            email: {
                type: 'string',
                format: 'email',
                example: 'alex@example.com',
                description: 'Trimmed valid email address.',
            },
            phone: {
                type: 'string',
                minLength: 1,
                example: '+8801712345678',
                description: 'Trimmed; must not be blank.',
            },
        },
    },
    ClientContact: {
        type: 'object',
        properties: {
            client: {
                $ref: '#/components/schemas/ObjectId',
            },
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Alex Smith',
                description: 'Trimmed; must not be blank.',
            },
            role: {
                type: 'string',
                minLength: 1,
                example: 'Site supervisor',
                description:
                    'Free-text contact role; not an account authorization role.',
            },
            email: {
                type: 'string',
                format: 'email',
                example: 'alex@example.com',
                description: 'Trimmed valid email address.',
            },
            phone: {
                type: 'string',
                minLength: 1,
                example: '+8801712345678',
                description: 'Trimmed; must not be blank.',
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
    ObjectId: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{24}$',
        example: '507f1f77bcf86cd799439011',
    },
    Pagination: {
        type: 'object',
        properties: {
            page: {
                type: 'integer',
                example: 1,
            },
            limit: {
                type: 'integer',
                example: 10,
            },
            total: {
                type: 'integer',
                example: 24,
            },
            totalPage: {
                type: 'integer',
                example: 3,
            },
        },
        required: ['page', 'limit', 'total', 'totalPage'],
    },
    Error: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                enum: [false],
            },
            message: {
                type: 'string',
            },
            errorDetails: {
                type: 'object',
                properties: {},
            },
            stack: {
                type: 'string',
                nullable: true,
            },
        },
        required: ['success', 'message'],
    },
    Null: {
        type: 'string',
        nullable: true,
        enum: [null],
    },
    Point: {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: 'array',
                items: {
                    type: 'number',
                },
                minItems: 2,
                maxItems: 2,
                description: 'GeoJSON [longitude, latitude].',
                example: [90.4125, 23.8103],
            },
        },
        required: ['coordinates'],
    },
    ClientCreate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Northstar Facilities',
            },
            email: {
                type: 'string',
                format: 'email',
                example: 'client@example.com',
            },
            phone: {
                type: 'string',
                example: '+8801700000000',
            },
            company_name: {
                type: 'string',
                example: 'Northstar Ltd',
            },
            licence_expiration_date: {
                type: 'string',
                format: 'date-time',
            },
            contract_status: {
                type: 'string',
                enum: ['Active', 'Inactive', 'Pending'],
            },
            password: {
                type: 'string',
                format: 'password',
                minLength: 6,
                example: 'ExamplePass123!',
            },
            confirmPassword: {
                type: 'string',
                format: 'password',
                example: 'ExamplePass123!',
            },
        },
        required: ['name', 'email', 'phone', 'password', 'confirmPassword'],
    },
    ClientUpdate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Northstar Facilities',
            },
            email: {
                type: 'string',
                format: 'email',
                example: 'client@example.com',
            },
            phone: {
                type: 'string',
                example: '+8801700000000',
            },
            company_name: {
                type: 'string',
                example: 'Northstar Ltd',
            },
            licence_expiration_date: {
                type: 'string',
                format: 'date-time',
            },
            contract_status: {
                type: 'string',
                enum: ['Active', 'Inactive', 'Pending'],
            },
        },
    },
    LocationCreate: {
        type: 'object',
        properties: {
            client: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Head Office',
            },
            address: {
                type: 'string',
                minLength: 1,
                example: '12 Example Road, Dhaka',
            },
            description: {
                type: 'string',
                example: 'Main downtown branch',
            },
            type: {
                type: 'string',
                enum: ['Hotel', 'School', 'Hospital', 'Other'],
            },
            is_active: {
                type: 'boolean',
            },
            location: {
                $ref: '#/components/schemas/Point',
            },
        },
        required: ['client', 'name', 'address', 'type'],
    },
    LocationUpdate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Head Office',
            },
            address: {
                type: 'string',
                minLength: 1,
                example: '12 Example Road, Dhaka',
            },
            description: {
                type: 'string',
                example: 'Main downtown branch',
            },
            type: {
                type: 'string',
                enum: ['Hotel', 'School', 'Hospital', 'Other'],
            },
            is_active: {
                type: 'boolean',
            },
            location: {
                $ref: '#/components/schemas/Point',
            },
        },
    },
    RoomCreate: {
        type: 'object',
        properties: {
            location: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Conference Room',
            },
            room_type: {
                type: 'string',
                minLength: 1,
                example: 'meeting',
            },
            cleaning_type: {
                type: 'string',
                minLength: 1,
                example: 'Standard',
            },
            floor: {
                type: 'number',
                example: 2,
            },
            is_active: {
                type: 'boolean',
            },
        },
        required: ['location', 'name', 'room_type', 'cleaning_type'],
    },
    RoomUpdate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Conference Room',
            },
            room_type: {
                type: 'string',
                minLength: 1,
                example: 'meeting',
            },
            cleaning_type: {
                type: 'string',
                minLength: 1,
                example: 'Standard',
            },
            floor: {
                type: 'number',
                example: 2,
            },
            is_active: {
                type: 'boolean',
            },
        },
    },
    TaskCreate: {
        type: 'object',
        properties: {
            room: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Clean meeting table',
            },
            frequency_type: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly'],
            },
            is_photo_required: {
                type: 'boolean',
            },
            photo_requirements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            minLength: 1,
                            example: 'Before cleaning',
                            description: 'Photo label defined by the admin.',
                        },
                        photo_url: {
                            type: 'string',
                            nullable: true,
                        },
                        is_uploaded: {
                            type: 'boolean',
                        },
                    },
                    required: ['title'],
                },
            },
            duration_minutes: {
                type: 'number',
                minimum: 0,
                exclusiveMinimum: true,
                example: 15,
            },
            days_of_week: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                },
            },
            days_of_month: {
                type: 'array',
                items: {
                    type: 'number',
                    minimum: 1,
                    maximum: 31,
                },
            },
            is_active: {
                type: 'boolean',
            },
        },
        required: ['room', 'name', 'frequency_type'],
        description:
            'weekly requires a nonempty days_of_week array; monthly requires a nonempty days_of_month array. client and location are resolved from room.',
    },
    TaskUpdate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Clean meeting table',
            },
            frequency_type: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly'],
            },
            is_photo_required: {
                type: 'boolean',
            },
            photo_requirements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            minLength: 1,
                            example: 'Before cleaning',
                            description: 'Photo label defined by the admin.',
                        },
                        photo_url: {
                            type: 'string',
                            nullable: true,
                        },
                        is_uploaded: {
                            type: 'boolean',
                        },
                    },
                    required: ['title'],
                },
            },
            duration_minutes: {
                type: 'number',
                minimum: 0,
                exclusiveMinimum: true,
                example: 15,
            },
            days_of_week: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                },
            },
            days_of_month: {
                type: 'array',
                items: {
                    type: 'number',
                    minimum: 1,
                    maximum: 31,
                },
            },
            is_active: {
                type: 'boolean',
            },
        },
        description:
            'If frequency_type is supplied as weekly or monthly, include its nonempty scheduling array in this request. Parent references cannot be changed through the documented update contract.',
    },
    WorkerCreate: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1, example: 'Alex Morgan', description: 'Worker name; surrounding whitespace is trimmed.' },
            email: {
                type: 'string',
                format: 'email',
                example: 'worker@example.com',
            },
            phone: {
                type: 'string',
                minLength: 1,
                example: '+8801700000000',
            },
            worker_type: {
                type: 'string',
                enum: ['Employee', 'Freelancer'],
            },
            address: {
                type: 'string',
                minLength: 1,
                example: '12 Example Road, Dhaka',
            },
            isagree_condition: {
                type: 'boolean',
            },
            dob: {
                type: 'string',
                format: 'date-time',
            },
            nationality: {
                type: 'string',
            },
            position: {
                type: 'string',
            },
            base_location: {
                type: 'string',
            },
            languages: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            employee_contract_pdf: {
                type: 'string',
            },
            working_days: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: [
                        'monday',
                        'tuesday',
                        'wednesday',
                        'thursday',
                        'friday',
                        'saturday',
                        'sunday',
                    ],
                },
                description:
                    'Only meaningful for Employee-type workers. Freelancers set this through /worker/my-availability.',
            },
            hourly_rate: {
                type: 'number',
                minimum: 0,
                example: 25,
            },
            is_profile_completed: {
                type: 'boolean',
            },
            id_card_front: {
                type: 'string',
            },
            id_card_back: {
                type: 'string',
            },
            certificates: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            national_id: {
                type: 'string',
            },
            password: {
                type: 'string',
                format: 'password',
                minLength: 6,
                maxLength: 72,
                example: 'ExamplePass123!',
            },
            confirmPassword: {
                type: 'string',
                format: 'password',
                example: 'ExamplePass123!',
            },
        },
        required: [
            'name',
            'email',
            'phone',
            'worker_type',
            'address',
            'password',
            'confirmPassword',
        ],
        description:
            'Extra keys are rejected (Zod strict object). Passwords must match.',
    },
    WorkerUpdate: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1, example: 'Alex Morgan', description: 'Worker name; surrounding whitespace is trimmed.' },
            email: {
                type: 'string',
                format: 'email',
                example: 'worker@example.com',
            },
            phone: {
                type: 'string',
                minLength: 1,
                example: '+8801700000000',
            },
            worker_type: {
                type: 'string',
                enum: ['Employee', 'Freelancer'],
            },
            address: {
                type: 'string',
                minLength: 1,
                example: '12 Example Road, Dhaka',
            },
            isagree_condition: {
                type: 'boolean',
            },
            dob: {
                type: 'string',
                format: 'date-time',
            },
            nationality: {
                type: 'string',
            },
            position: {
                type: 'string',
            },
            base_location: {
                type: 'string',
            },
            languages: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            employee_contract_pdf: {
                type: 'string',
            },
            working_days: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: [
                        'monday',
                        'tuesday',
                        'wednesday',
                        'thursday',
                        'friday',
                        'saturday',
                        'sunday',
                    ],
                },
                description:
                    'Manager may only set this when the target worker is Employee-type; rejected for Freelancers.',
            },
            hourly_rate: {
                type: 'number',
                minimum: 0,
                example: 25,
            },
            is_profile_completed: {
                type: 'boolean',
            },
            id_card_front: {
                type: 'string',
            },
            id_card_back: {
                type: 'string',
            },
            certificates: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            national_id: {
                type: 'string',
            },
        },
        description:
            'Partial update; provide at least one field. Extra keys are rejected (Zod strict object).',
    },
    CleaningPlanCreate: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                minLength: 1,
                example: 'Weekly office deep clean',
            },
            description: {
                type: 'string',
                minLength: 1,
                example: 'Full deep clean of the head office.',
            },
            client: {
                $ref: '#/components/schemas/ObjectId',
            },
            location: {
                $ref: '#/components/schemas/ObjectId',
            },
            rooms: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/ObjectId',
                },
            },
            assigned_workers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        worker: {
                            $ref: '#/components/schemas/ObjectId',
                        },
                        role: {
                            type: 'string',
                            enum: [
                                'Team leader',
                                'Co-leader',
                                'Normal worker',
                            ],
                        },
                    },
                    required: ['worker', 'role'],
                },
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
            end_date: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description:
                    'Optional bound for recurrence-based conflict checking. Null/omitted means indefinite.',
            },
            note: {
                type: 'string',
                nullable: true,
            },
            status: {
                type: 'string',
                enum: ['active', 'inactive', 'completed'],
            },
            force: {
                type: 'boolean',
                description:
                    'When assigned_workers is provided and a worker has a scheduling conflict, set true to assign anyway.',
            },
        },
        required: [
            'title',
            'description',
            'client',
            'location',
            'date_time',
        ],
        description:
            'manager is taken from the authenticated profile. Client must not be deleted and location must be active. max_estimated_duration is server-computed from the rooms\' active tasks and cannot be set directly.',
    },
    CleaningPlanUpdate: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                minLength: 1,
                example: 'Weekly office deep clean',
            },
            description: {
                type: 'string',
                minLength: 1,
                example: 'Full deep clean of the head office.',
            },
            rooms: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/ObjectId',
                },
            },
            assigned_workers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        worker: {
                            $ref: '#/components/schemas/ObjectId',
                        },
                        role: {
                            type: 'string',
                            enum: [
                                'Team leader',
                                'Co-leader',
                                'Normal worker',
                            ],
                        },
                    },
                    required: ['worker', 'role'],
                },
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
            end_date: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            note: {
                type: 'string',
                nullable: true,
            },
            status: {
                type: 'string',
                enum: ['active', 'inactive', 'completed'],
            },
            force: {
                type: 'boolean',
                description:
                    'When assigned_workers is provided and a worker has a scheduling conflict, set true to assign anyway.',
            },
        },
        description:
            'Partial update. Parent client/location cannot be changed through the documented update contract. max_estimated_duration is server-computed from the rooms\' active tasks whenever rooms changes.',
    },
    AdditionalTaskCreate: {
        type: 'object',
        properties: {
            cleaning_plan_id: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Vacuum hallway carpet',
            },
            description: {
                type: 'string',
            },
            duration_minutes: {
                type: 'number',
                minimum: 0,
                example: 20,
            },
            is_photo_required: {
                type: 'boolean',
            },
            photo_requirements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            minLength: 1,
                            example: 'Before cleaning',
                        },
                        photo_url: {
                            type: 'string',
                            nullable: true,
                        },
                        is_uploaded: {
                            type: 'boolean',
                        },
                    },
                    required: ['title'],
                },
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
        },
        required: [
            'cleaning_plan_id',
            'name',
            'duration_minutes',
            'date_time',
        ],
        description:
            'Clients and managers can create tasks; the cleaning plan must exist and be active. is_completed is false. is_approved is true for managers and false for clients, determined by the authenticated role rather than the request body.',
    },
    AdditionalTaskUpdate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Vacuum hallway carpet',
            },
            description: {
                type: 'string',
            },
            duration_minutes: {
                type: 'number',
                minimum: 0,
                example: 20,
            },
            is_photo_required: {
                type: 'boolean',
            },
            photo_requirements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            minLength: 1,
                            example: 'Before cleaning',
                        },
                        photo_url: {
                            type: 'string',
                            nullable: true,
                        },
                        is_uploaded: {
                            type: 'boolean',
                        },
                    },
                    required: ['title'],
                },
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
            is_completed: {
                type: 'boolean',
            },
        },
        description:
            'Partial update. is_approved is stripped by the service even if supplied; use the approve endpoint instead.',
    },
    Client: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                example: 'Northstar Facilities',
            },
            email: {
                type: 'string',
                format: 'email',
                example: 'client@example.com',
            },
            phone: {
                type: 'string',
                example: '+8801700000000',
            },
            company_name: {
                type: 'string',
                nullable: true,
            },
            licence_expiration_date: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            contract_status: {
                type: 'string',
                enum: ['Active', 'Inactive', 'Pending'],
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            last_updated_by: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            created_at: {
                type: 'string',
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
            },
            user: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            manager: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            isDeleted: {
                type: 'boolean',
            },
        },
    },
    Location: {
        type: 'object',
        properties: {
            client: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Head Office',
            },
            address: {
                type: 'string',
                minLength: 1,
                example: '12 Example Road, Dhaka',
            },
            description: {
                type: 'string',
                example: 'Main downtown branch',
            },
            type: {
                type: 'string',
                enum: ['Hotel', 'School', 'Hospital', 'Other'],
            },
            is_active: {
                type: 'boolean',
            },
            location: {
                $ref: '#/components/schemas/Point',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            last_updated_by: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            created_at: {
                type: 'string',
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
            },
            total_room: {
                type: 'integer',
                readOnly: true,
                description: 'Included by aggregation reads.',
            },
        },
    },
    Room: {
        type: 'object',
        properties: {
            location: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Conference Room',
            },
            room_type: {
                type: 'string',
                minLength: 1,
                example: 'meeting',
            },
            cleaning_type: {
                type: 'string',
                minLength: 1,
                example: 'Standard',
            },
            floor: {
                type: 'number',
                nullable: true,
            },
            is_active: {
                type: 'boolean',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            last_updated_by: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
                type: 'string',
                format: 'date-time',
            },
            total_task: {
                type: 'integer',
                readOnly: true,
                description: 'Included by aggregation reads.',
            },
        },
    },
    Task: {
        type: 'object',
        properties: {
            room: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Clean meeting table',
            },
            frequency_type: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly'],
            },
            is_photo_required: {
                type: 'boolean',
            },
            photo_requirements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            minLength: 1,
                            example: 'Before cleaning',
                            description: 'Photo label defined by the admin.',
                        },
                        photo_url: {
                            type: 'string',
                            nullable: true,
                        },
                        is_uploaded: {
                            type: 'boolean',
                        },
                    },
                },
            },
            duration_minutes: {
                type: 'number',
                nullable: true,
            },
            days_of_week: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                },
            },
            days_of_month: {
                type: 'array',
                items: {
                    type: 'number',
                    minimum: 1,
                    maximum: 31,
                },
            },
            is_active: {
                type: 'boolean',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            last_updated_by: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            created_at: {
                type: 'string',
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
            },
            client: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            location: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
        },
    },
    Worker: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1, example: 'Alex Morgan', description: 'Worker name; surrounding whitespace is trimmed.' },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            email: {
                type: 'string',
                format: 'email',
                nullable: true,
            },
            phone: {
                type: 'string',
                nullable: true,
            },
            user: {
                $ref: '#/components/schemas/ObjectId',
            },
            isagree_condition: {
                type: 'boolean',
            },
            dob: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            nationality: {
                type: 'string',
                nullable: true,
            },
            worker_type: {
                type: 'string',
                enum: ['Employee', 'Freelancer'],
                nullable: true,
            },
            position: {
                type: 'string',
                nullable: true,
            },
            address: {
                type: 'string',
                nullable: true,
            },
            base_location: {
                type: 'string',
                nullable: true,
            },
            languages: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            employee_contract_pdf: {
                type: 'string',
                nullable: true,
            },
            working_days: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: [
                        'monday',
                        'tuesday',
                        'wednesday',
                        'thursday',
                        'friday',
                        'saturday',
                        'sunday',
                    ],
                },
            },
            hourly_rate: {
                type: 'number',
                default: 25,
            },
            is_profile_completed: {
                type: 'boolean',
            },
            id_card_front: {
                type: 'string',
                nullable: true,
            },
            id_card_back: {
                type: 'string',
                nullable: true,
            },
            certificates: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            national_id: {
                type: 'string',
                nullable: true,
            },
            isDeleted: {
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
    CleaningPlan: {
        type: 'object',
        properties: {
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            title: {
                type: 'string',
                minLength: 1,
                example: 'Weekly office deep clean',
            },
            description: {
                type: 'string',
                minLength: 1,
                example: 'Full deep clean of the head office.',
            },
            manager: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                description:
                    'ObjectId on writes; populated document on reads (list and single endpoints).',
            },
            last_updated_by: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                nullable: true,
                description:
                    'ObjectId on writes; populated document on reads. May be null.',
            },
            client: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                description:
                    'ObjectId on writes; populated document on reads.',
            },
            location: {
                oneOf: [
                    {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    {
                        type: 'object',
                        properties: {
                            _id: {
                                type: 'string',
                                pattern: '^[a-fA-F0-9]{24}$',
                                example: '507f1f77bcf86cd799439011',
                            },
                        },
                    },
                ],
                description:
                    'ObjectId on writes; populated document on reads.',
            },
            rooms: {
                type: 'array',
                items: {
                    oneOf: [
                        {
                            type: 'string',
                            pattern: '^[a-fA-F0-9]{24}$',
                            example: '507f1f77bcf86cd799439011',
                        },
                        {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    pattern: '^[a-fA-F0-9]{24}$',
                                    example: '507f1f77bcf86cd799439011',
                                },
                            },
                        },
                    ],
                },
                description:
                    'ObjectIds on writes. The single-plan read populates full room documents; the list read omits this field entirely.',
            },
            assigned_workers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        worker: {
                            oneOf: [
                                {
                                    type: 'string',
                                    pattern: '^[a-fA-F0-9]{24}$',
                                    example: '507f1f77bcf86cd799439011',
                                },
                                {
                                    type: 'object',
                                    properties: {
                                        _id: {
                                            type: 'string',
                                            pattern: '^[a-fA-F0-9]{24}$',
                                            example:
                                                '507f1f77bcf86cd799439011',
                                        },
                                    },
                                },
                            ],
                            description:
                                'ObjectId on writes. The single-plan read populates the full worker document; the list read omits this field entirely.',
                        },
                        role: {
                            type: 'string',
                            enum: [
                                'Team leader',
                                'Co-leader',
                                'Normal worker',
                            ],
                        },
                        assigned_with_conflict: {
                            type: 'boolean',
                            description:
                                'True if this worker was assigned via force=true despite a scheduling conflict.',
                        },
                    },
                },
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
            end_date: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            max_estimated_duration: {
                type: 'number',
                description:
                    'Server-computed conservative upper bound (minutes) from the sum of duration_minutes across the plan rooms\' active tasks.',
            },
            note: {
                type: 'string',
                nullable: true,
            },
            status: {
                type: 'string',
                enum: ['active', 'inactive', 'completed'],
            },
            is_active: {
                type: 'boolean',
            },
            additional_tasks: {
                type: 'array',
                items: {
                    oneOf: [
                        {
                            type: 'string',
                            pattern: '^[a-fA-F0-9]{24}$',
                            example: '507f1f77bcf86cd799439011',
                        },
                        {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    pattern: '^[a-fA-F0-9]{24}$',
                                    example: '507f1f77bcf86cd799439011',
                                },
                            },
                        },
                    ],
                },
                description:
                    'ObjectIds on writes. The single-plan read populates full additional-task documents; the list read omits this field entirely.',
            },
            total_room: {
                type: 'integer',
                readOnly: true,
                description:
                    'Included by the list aggregation only (count of rooms).',
            },
            total_assigned_worker: {
                type: 'integer',
                readOnly: true,
                description: 'Included by the list aggregation only.',
            },
            total_additional_task: {
                type: 'integer',
                readOnly: true,
                description: 'Included by the list aggregation only.',
            },
            total_rooms: {
                type: 'integer',
                readOnly: true,
                description:
                    'Included by the single-plan aggregation only (count of rooms).',
            },
            total_assigned_workers: {
                type: 'integer',
                readOnly: true,
                description: 'Included by the single-plan aggregation only.',
            },
            total_additional_tasks_pending: {
                type: 'integer',
                readOnly: true,
                description:
                    'Included by the single-plan aggregation only. Count of additional tasks with is_completed=false.',
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
    AdditionalTask: {
        type: 'object',
        properties: {
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            cleaning_plan_id: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
                minLength: 1,
                example: 'Vacuum hallway carpet',
            },
            description: {
                type: 'string',
            },
            duration_minutes: {
                type: 'number',
                minimum: 0,
                example: 20,
            },
            is_photo_required: {
                type: 'boolean',
            },
            photo_requirements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            minLength: 1,
                            example: 'Before cleaning',
                        },
                        photo_url: {
                            type: 'string',
                            nullable: true,
                        },
                        is_uploaded: {
                            type: 'boolean',
                        },
                    },
                },
            },
            is_completed: {
                type: 'boolean',
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
            is_approved: {
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
    Login: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
                example: 'manager@example.com',
            },
            password: {
                type: 'string',
                format: 'password',
                example: 'ExamplePass123!',
            },
            role: {
                type: 'string',
                enum: ['client', 'worker', 'manager', 'admin', 'superAdmin'],
                description:
                    'Optional service-level role selection; not validated by the login Zod schema.',
            },
            playerId: {
                type: 'string',
                description: 'Optional push device ID.',
            },
            platform: {
                type: 'string',
                enum: ['android', 'ios', 'web'],
                default: 'android',
            },
        },
        required: ['email', 'password'],
    },
    Tokens: {
        type: 'object',
        properties: {
            accessToken: {
                type: 'string',
            },
            refreshToken: {
                type: 'string',
            },
            role: {
                type: 'string',
            },
        },
        required: ['accessToken'],
    },
    EmailRequest: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
                example: 'client@example.com',
            },
        },
        required: ['email'],
    },
    ChangePassword: {
        type: 'object',
        properties: {
            oldPassword: {
                type: 'string',
                format: 'password',
            },
            newPassword: {
                type: 'string',
                format: 'password',
            },
            confirmNewPassword: {
                type: 'string',
                format: 'password',
            },
        },
        required: ['oldPassword', 'newPassword', 'confirmNewPassword'],
    },
    ResetPassword: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
            },
            password: {
                type: 'string',
                format: 'password',
            },
            confirmPassword: {
                type: 'string',
                format: 'password',
            },
        },
        required: ['email', 'password', 'confirmPassword'],
    },
    VerifyResetOtp: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
            },
            resetCode: {
                type: 'number',
                example: 123456,
            },
        },
        required: ['email', 'resetCode'],
    },
    Notification: {
        type: 'object',
        properties: {
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            receiver: {
                type: 'string',
            },
            type: {
                type: 'string',
            },
            title: {
                type: 'string',
            },
            message: {
                type: 'string',
            },
            data: {
                type: 'object',
                properties: {
                    entity: {
                        type: 'string',
                    },
                    action: {
                        type: 'string',
                    },
                    entityId: {
                        type: 'string',
                        pattern: '^[a-fA-F0-9]{24}$',
                        example: '507f1f77bcf86cd799439011',
                    },
                    meta: {
                        type: 'object',
                        properties: {},
                    },
                },
            },
            isRead: {
                type: 'boolean',
            },
            isSeen: {
                type: 'boolean',
            },
            readAt: {
                type: 'string',
                format: 'date-time',
            },
            seenAt: {
                type: 'string',
                format: 'date-time',
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
    UpdateResult: {
        type: 'object',
        properties: {
            acknowledged: {
                type: 'boolean',
            },
            matchedCount: {
                type: 'integer',
            },
            modifiedCount: {
                type: 'integer',
            },
        },
    },
    LegalInfo: {
        type: 'object',
        properties: {
            venueOwner: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            companyName: {
                type: 'string',
            },
            businessType: {
                type: 'string',
            },
            registeredAddress: {
                type: 'string',
            },
            contactEmail: {
                type: 'string',
            },
            contactPhone: {
                type: 'string',
            },
            jurisdiction: {
                type: 'string',
            },
            officialWebsite: {
                type: 'string',
            },
            platformFeePercentage: {
                type: 'number',
                default: 20,
            },
            freeCancellationHour: {
                type: 'number',
                default: 24,
            },
        },
    },
    AboutUsInput: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'About our company.',
            },
        },
        required: ['description'],
    },
    AboutUs: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'About our company.',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    PrivacyPolicyInput: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'Privacy policy text.',
            },
        },
        required: ['description'],
    },
    PrivacyPolicy: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'Privacy policy text.',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    TermsConditionsInput: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'Terms and conditions.',
            },
        },
        required: ['description'],
    },
    TermsConditions: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'Terms and conditions.',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    PartnerInput: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'Partner information.',
            },
        },
        required: ['description'],
    },
    Partner: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                example: 'Partner information.',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    ContactDetailsInput: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
                example: 'support@example.com',
            },
            phone_number: {
                type: 'string',
                example: '+8801700000000',
            },
        },
        required: ['email', 'phone_number'],
    },
    ContactDetails: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
                example: 'support@example.com',
            },
            phone_number: {
                type: 'string',
                example: '+8801700000000',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    FAQInput: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                example: 'How do I contact support?',
            },
            answer: {
                type: 'string',
                example: 'Email support@example.com.',
            },
        },
        required: ['question', 'answer'],
    },
    FAQ: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                example: 'How do I contact support?',
            },
            answer: {
                type: 'string',
                example: 'Email support@example.com.',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    SliderInput: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                example: 'Welcome',
            },
            image: {
                type: 'string',
            },
        },
        required: ['title', 'image'],
    },
    Slider: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                example: 'Welcome',
            },
            image: {
                type: 'string',
            },
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
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
    Admin: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            user: {
                $ref: '#/components/schemas/ObjectId',
            },
            name: {
                type: 'string',
            },
            email: {
                type: 'string',
                format: 'email',
            },
            phone: {
                type: 'string',
            },
            profile_image: {
                type: 'string',
            },
            address: {
                type: 'string',
                nullable: true,
            },
            website: {
                type: 'string',
                nullable: true,
            },
            isActive: {
                type: 'boolean',
            },
        },
    },
    AdminCreate: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
            },
            email: {
                type: 'string',
                format: 'email',
            },
            password: {
                type: 'string',
                format: 'password',
            },
            confirmPassword: {
                type: 'string',
                format: 'password',
            },
            address: {
                type: 'string',
            },
            website: {
                type: 'string',
            },
        },
        required: ['name', 'email', 'password', 'confirmPassword'],
        description:
            'Required by account creation, although the current Zod schema makes these fields optional. Passwords must match.',
    },
    Shift: {
        type: 'object',
        properties: {
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            cleaning_plan: {
                $ref: '#/components/schemas/ObjectId',
            },
            date: {
                type: 'string',
                format: 'date-time',
                description: 'Calendar day (UTC midnight) this occurrence is for.',
            },
            date_time: {
                type: 'string',
                format: 'date-time',
                description: "This occurrence's actual start timestamp.",
            },
            location: {
                type: 'object',
                properties: {
                    location: { $ref: '#/components/schemas/ObjectId' },
                    name: { type: 'string' },
                    coordinates: {
                        type: 'object',
                        nullable: true,
                        properties: {
                            type: { type: 'string', enum: ['Point'] },
                            coordinates: {
                                type: 'array',
                                items: { type: 'number' },
                                minItems: 2,
                                maxItems: 2,
                                description: '[longitude, latitude]',
                            },
                        },
                        description:
                            'null when the source Location has no GPS point configured — check-in cannot be validated for such a shift.',
                    },
                },
                description:
                    "Frozen snapshot of the plan's location, used as the geofence center for check-in/check-out.",
            },
            rooms: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        room: { $ref: '#/components/schemas/ObjectId' },
                        name: { type: 'string' },
                        room_type: { type: 'string' },
                    },
                    description:
                        'room is kept for traceability only — name/room_type are a frozen snapshot and never re-derived by populating it.',
                },
                description:
                    "Snapshot of the plan's rooms at materialization time. Immutable — later edits to the source Room do not affect it.",
            },
            tasks: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        task: { $ref: '#/components/schemas/ObjectId' },
                        room: { $ref: '#/components/schemas/ObjectId' },
                        name: { type: 'string' },
                        duration_minutes: { type: 'number' },
                        is_photo_required: { type: 'boolean' },
                        photo_requirements: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    photo_url: { type: 'string', nullable: true },
                                    is_uploaded: { type: 'boolean' },
                                },
                            },
                            description:
                                "Titles are a frozen snapshot of the source Task's template; photo_url/is_uploaded always start unset for this occurrence, independent of any other day's shift.",
                        },
                        is_completed: {
                            type: 'boolean',
                            description:
                                'Auto-derived: true once every required photo_requirements entry is uploaded (or immediately if none are required). No manual complete/approve step.',
                        },
                        completed_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                        status: {
                            type: 'string',
                            enum: ['UPCOMING', 'IN_PROGRESS', 'COMPLETED'],
                            description:
                                'Defaults to UPCOMING at materialization time. Transitions to IN_PROGRESS/COMPLETED are set manually (no automatic transition logic yet).',
                        },
                    },
                    description:
                        'task/room are kept for traceability only — the rest is a frozen snapshot for this specific occurrence.',
                },
                description:
                    "One entry per active Task on the plan's rooms at materialization time — this is where actual photo submissions and completion state live, per occurrence. See docs/SHIFT_MANAGEMENT_DESIGN.md.",
            },
            duration_minutes: {
                type: 'number',
                description: "Snapshot of the plan's max_estimated_duration at materialization time.",
            },
            assigned_workers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        worker: { $ref: '#/components/schemas/ObjectId' },
                        name: {
                            type: 'string',
                            description:
                                "Frozen snapshot of the worker's name at assignment time — immune to later profile edits.",
                        },
                        role: {
                            type: 'string',
                            enum: [
                                'Team leader',
                                'Co-leader',
                                'Normal worker',
                            ],
                        },
                        assigned_with_conflict: {
                            type: 'boolean',
                            description:
                                'True if this worker was assigned via force=true despite a scheduling conflict.',
                        },
                        check_in_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                        check_in_coordinates: {
                            type: 'array',
                            items: { type: 'number' },
                            minItems: 2,
                            maxItems: 2,
                            nullable: true,
                            description: '[longitude, latitude] the worker checked in from.',
                        },
                        check_out_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                        check_out_coordinates: {
                            type: 'array',
                            items: { type: 'number' },
                            minItems: 2,
                            maxItems: 2,
                            nullable: true,
                            description: '[longitude, latitude] the worker checked out from.',
                        },
                    },
                },
                description:
                    'Defaults to a snapshot of the plan\'s assigned_workers (with worker names resolved) at materialization time until overridden for this specific occurrence.',
            },
            is_worker_overridden: {
                type: 'boolean',
                description:
                    "True once a manager has edited this occurrence's workers directly, diverging it from the plan's default assignment.",
            },
            is_virtual: {
                type: 'boolean',
                description:
                    'True when this occurrence has not been persisted yet (computed live from the plan definition) — writing to it (assign-workers/status) materializes a real Shift document first.',
            },
            status: {
                type: 'string',
                enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
            },
            last_updated_by: {
                $ref: '#/components/schemas/ObjectId',
                nullable: true,
            },
        },
        description:
            'A single-day occurrence of a CleaningPlan, derived from the recurrence of the active Tasks on its rooms. See docs/SHIFT_MANAGEMENT_DESIGN.md.',
    },
};
export default schemas;
