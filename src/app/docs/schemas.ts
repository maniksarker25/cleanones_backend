// Shared OpenAPI 3.0 schemas. Keep in sync with validation, models and services.
import chatSchemas from './chat.schemas';
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
            "status": {
                "type": "string",
                "enum": [
                    "PENDING",
                    "IN_PROGRESS",
                    "RESOLVED"
                ]
            }
        }
    },
    "IssueReport": {
        "type": "object",
        "properties": {
            worker: { $ref: '#/components/schemas/ObjectId' },
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
            "status": {
                "type": "string",
                "enum": [
                    "PENDING",
                    "IN_PROGRESS",
                    "RESOLVED"
                ],
                "default": "PENDING"
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
                description:
                    'Pool of possible photo titles. required_photo_count of these are picked at random per shift occurrence.',
            },
            required_photo_count: {
                type: 'integer',
                minimum: 1,
                description:
                    'How many titles from photo_requirements to randomly require per occurrence. Required when is_photo_required is true; must not exceed photo_requirements.length.',
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
            'weekly requires a nonempty days_of_week array; monthly requires a nonempty days_of_month array. client and location are resolved from room. When is_photo_required is true, photo_requirements (nonempty) and required_photo_count (<= photo_requirements.length) are both required.',
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
                description:
                    'Pool of possible photo titles. required_photo_count of these are picked at random per shift occurrence.',
            },
            required_photo_count: {
                type: 'integer',
                minimum: 1,
                description:
                    'How many titles from photo_requirements to randomly require per occurrence. Required when is_photo_required is true; must not exceed photo_requirements.length.',
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
            'If frequency_type is supplied as weekly or monthly, include its nonempty scheduling array in this request. Parent references cannot be changed through the documented update contract. When is_photo_required is true, photo_requirements (nonempty) and required_photo_count (<= photo_requirements.length) are both required.',
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
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
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
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
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
                description:
                    'Pool of possible photo titles. required_photo_count of these are picked at random per shift occurrence.',
            },
            required_photo_count: {
                type: 'integer',
                nullable: true,
                description:
                    'How many titles from photo_requirements are randomly required per occurrence.',
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
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
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
            total_earning: {
                type: 'number',
                default: 0,
                readOnly: true,
                description:
                    'Accrued automatically on each shift check-out (worked hours * hourly_rate at that time). Not directly settable.',
            },
            total_paid: {
                type: 'number',
                default: 0,
                readOnly: true,
                description:
                    'Amount paid out to the worker so far. Increases when a manager creates an Invoice for this worker.',
            },
            pending_amount: {
                type: 'number',
                default: 0,
                readOnly: true,
                description:
                    'total_earning - total_paid. Caps how much a manager can invoice for this worker at once.',
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
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
                type: 'string',
                format: 'date-time',
            },
            total_completed_work_hours: {
                type: 'number',
                readOnly: true,
                description:
                    "Included by the all-workers list endpoint only. All-time sum of (check_out_at - check_in_at) across this worker's completed shift check-ins, in hours, rounded to 2 decimals.",
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
                                name: { type: 'string' },
                                room_type: { type: 'string' },
                                cleaning_type: { type: 'string' },
                                floor: { type: 'number', nullable: true },
                                is_active: { type: 'boolean' },
                                tasks: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Task' },
                                    description:
                                        "This room's active Task documents, full detail. Only present on the single-plan read.",
                                },
                            },
                        },
                    ],
                },
                description:
                    'ObjectIds on writes. The single-plan read populates full room documents (each with its active tasks[] populated); the list read omits this field entirely.',
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
                items: { $ref: '#/components/schemas/AdditionalTask' },
                readOnly: true,
                description:
                    'Not stored on the plan document. Populated by the single-plan read via a lookup against the additional-tasks collection (matched by cleaning_plan_id); the list read omits this field entirely.',
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
                        task: {
                            $ref: '#/components/schemas/ObjectId',
                            description: "Points at the source Task for source 'plan_task', or the source AdditionalTask for source 'additional_task'.",
                        },
                        room: {
                            allOf: [{ $ref: '#/components/schemas/ObjectId' }],
                            nullable: true,
                            description: "Only set for source 'plan_task' — an additional task isn't scoped to one room.",
                        },
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
                                "Titles are a frozen snapshot of the source Task's (or AdditionalTask's) template; photo_url/is_uploaded always start unset for this occurrence, independent of any other day's shift.",
                        },
                        is_completed: {
                            type: 'boolean',
                            description:
                                "Auto-derived: true once every required photo_requirements entry is uploaded (or immediately if none are required). No manual complete/approve step. Once every task on the shift has is_completed: true, the shift's own top-level status auto-advances to 'completed'.",
                        },
                        completed_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                        source: {
                            type: 'string',
                            enum: ['plan_task', 'additional_task'],
                            description:
                                "'plan_task' (default): one of the plan's recurring room tasks. 'additional_task': a one-off AdditionalTask whose date_time fell on this shift's date, folded in at materialization or when approved afterward.",
                        },
                    },
                    description:
                        'task/room are kept for traceability only — the rest is a frozen snapshot for this specific occurrence.',
                },
                description:
                    "One entry per active Task on the plan's rooms at materialization time, PLUS one entry per approved AdditionalTask whose date_time falls on this shift's date (source: 'additional_task') — this is where actual photo submissions and completion state live, per occurrence. See docs/SHIFT_MANAGEMENT_DESIGN.md.",
            },
            duration_minutes: {
                type: 'number',
                description: "Snapshot of the plan's max_estimated_duration at materialization time, plus the summed duration_minutes of any included additional tasks.",
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
    ShiftLiveStatus: {
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
            },
            date_time: {
                type: 'string',
                format: 'date-time',
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
                    },
                },
            },
            duration_minutes: {
                type: 'number',
            },
            assigned_workers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        worker: { $ref: '#/components/schemas/ObjectId' },
                        name: { type: 'string' },
                        role: {
                            type: 'string',
                            enum: ['Team leader', 'Co-leader', 'Normal worker'],
                        },
                        check_in_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                        check_out_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                    },
                },
            },
            status: {
                type: 'string',
                enum: ['in_progress'],
                description: 'Always in_progress — this endpoint only returns currently active shifts.',
            },
            total_room: {
                type: 'integer',
            },
            completed_room: {
                type: 'integer',
                description: 'Count of rooms at progress_percent 100.',
            },
            total_task: {
                type: 'integer',
            },
            overall_progress_percent: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
                description:
                    "Average of each room's progress_percent. 0 when the shift has no rooms.",
            },
            rooms: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        room: { $ref: '#/components/schemas/ObjectId' },
                        name: { type: 'string' },
                        room_type: { type: 'string' },
                        total_task: { type: 'integer' },
                        completed_task: { type: 'integer' },
                        progress_percent: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 100,
                            description:
                                'completed_task / total_task for this room, rounded. 0 when the room has no tasks.',
                        },
                    },
                },
            },
        },
        description:
            'A live, computed-on-read progress view of one in_progress Shift. tasks[] is intentionally omitted — see the Shift schema for the full per-task detail (photo_requirements, is_completed, etc.).',
    },
    ShiftSummary: {
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
            },
            date_time: {
                type: 'string',
                format: 'date-time',
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
                    },
                },
            },
            duration_minutes: {
                type: 'number',
            },
            status: {
                type: 'string',
                enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
            },
            is_worker_overridden: {
                type: 'boolean',
            },
            last_updated_by: {
                $ref: '#/components/schemas/ObjectId',
                nullable: true,
            },
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
                type: 'string',
                format: 'date-time',
            },
            is_virtual: {
                type: 'boolean',
                description:
                    'True when this occurrence has no Shift document yet (projected from the plan\'s recurrence, not persisted) — no check-in/photo actions are possible on it until it materializes. _id/createdAt/updatedAt are absent in that case.',
            },
        },
        description:
            'A Shift without its tasks[]/rooms[]/assigned_workers[] arrays — used where a dashboard only needs the schedule/location/status, not the full detail.',
    },
    ShiftWithProgress: {
        allOf: [
            { $ref: '#/components/schemas/ShiftSummary' },
            {
                type: 'object',
                properties: {
                    total_room: { type: 'integer' },
                    completed_room: {
                        type: 'integer',
                        description: 'Count of rooms at progress_percent 100.',
                    },
                    total_task: { type: 'integer' },
                    overall_progress_percent: {
                        type: 'integer',
                        minimum: 0,
                        maximum: 100,
                    },
                },
            },
        ],
        description:
            "ShiftSummary plus computed overall progress totals — no rooms[]/tasks[]/assigned_workers[] detail. Used by the worker-facing active-shift endpoint, which is a dashboard summary card, not a task-execution view.",
    },
    WorkerPerformance: {
        type: 'object',
        properties: {
            month: {
                type: 'integer',
                minimum: 1,
                maximum: 12,
            },
            year: {
                type: 'integer',
            },
            total_shift_on_this_month: {
                type: 'integer',
                description:
                    "Materialized Shift documents this month plus not-yet-materialized future occurrences projected from the worker's currently active plans.",
            },
            total_completed_on_this_month: {
                type: 'integer',
                description: "Materialized shifts this month with status 'completed'.",
            },
            total_in_progress: {
                type: 'integer',
                description:
                    "Materialized shifts this month with status 'in_progress' — realistically 0 or 1 at any given time.",
            },
            total_upcoming_on_this_month: {
                type: 'integer',
                description:
                    "Materialized shifts this month with status 'upcoming', plus the projected not-yet-materialized future occurrences.",
            },
            total_late_on_this_month: {
                type: 'integer',
                description:
                    "Count of this month's materialized shifts where this worker's own check_in_at is after the shift's scheduled date_time. No grace period.",
            },
            total_absent_on_this_month: {
                type: 'integer',
                description:
                    "Count of this month's materialized shifts whose calendar date is in the past, status isn't 'cancelled', and this worker never checked in. Only ever counted for shifts that were actually materialized — an occurrence that was never materialized at all leaves no record to judge absence from.",
            },
            total_work_on_this_month: {
                type: 'number',
                description:
                    'Sum of (check_out_at - check_in_at) across this worker\'s completed check-ins this month, in hours, rounded to 2 decimals.',
            },
        },
        required: [
            'month',
            'year',
            'total_shift_on_this_month',
            'total_completed_on_this_month',
            'total_in_progress',
            'total_upcoming_on_this_month',
            'total_late_on_this_month',
            'total_absent_on_this_month',
            'total_work_on_this_month',
        ],
    },
    AttendanceSummary: {
        type: 'object',
        properties: {
            period: {
                type: 'string',
                enum: ['today', 'weekly', 'monthly'],
            },
            start_date: {
                type: 'string',
                format: 'date-time',
                description: 'Inclusive UTC start of the period.',
            },
            end_date: {
                type: 'string',
                format: 'date-time',
                description: 'Exclusive UTC end of the period.',
            },
            total_hours: {
                type: 'number',
                description:
                    "Sum of (check_out_at - check_in_at) across every worker's completed check-ins in the period, in hours, rounded to 2 decimals.",
            },
            completed_shifts: {
                type: 'integer',
                description: "Shifts with status 'completed' whose date falls in the period.",
            },
            punctuality_percentage: {
                type: 'number',
                description:
                    'Of all worker check-ins in the period, the share that were on-time (check_in_at <= shift.date_time, no grace period). 0 when there were no check-ins.',
            },
            on_time_check_ins: {
                type: 'integer',
            },
            late_check_ins: {
                type: 'integer',
            },
        },
        required: [
            'period',
            'start_date',
            'end_date',
            'total_hours',
            'completed_shifts',
            'punctuality_percentage',
            'on_time_check_ins',
            'late_check_ins',
        ],
    },
    WorkerAttendanceSummary: {
        type: 'object',
        properties: {
            period: {
                type: 'string',
                enum: ['today', 'weekly', 'monthly'],
            },
            start_date: {
                type: 'string',
                format: 'date-time',
                description: 'Inclusive UTC start of the period.',
            },
            end_date: {
                type: 'string',
                format: 'date-time',
                description: 'Exclusive UTC end of the period.',
            },
            total_hours: {
                type: 'number',
                description:
                    "Sum of (check_out_at - check_in_at) across this worker's completed check-ins in the period, in hours, rounded to 2 decimals.",
            },
            completed_shifts: {
                type: 'integer',
                description: "This worker's shifts with status 'completed' whose date falls in the period.",
            },
            punctuality_percentage: {
                type: 'number',
                description:
                    "Of this worker's check-ins in the period, the share that were on-time (check_in_at <= shift.date_time, no grace period). 0 when there were no check-ins.",
            },
            total_check_ins: {
                type: 'integer',
            },
            on_time_check_ins: {
                type: 'integer',
            },
            late_check_ins: {
                type: 'integer',
            },
        },
        required: [
            'period',
            'start_date',
            'end_date',
            'total_hours',
            'completed_shifts',
            'punctuality_percentage',
            'total_check_ins',
            'on_time_check_ins',
            'late_check_ins',
        ],
    },
    WorkerAttendanceListItem: {
        type: 'object',
        properties: {
            worker_id: { $ref: '#/components/schemas/ObjectId' },
            name: { type: 'string' },
            worker_type: { type: 'string', enum: ['Employee', 'Freelancer'] },
            hours_worked: {
                type: 'number',
                description:
                    "Sum of (check_out_at - check_in_at) across this worker's completed check-ins in the period, in hours, rounded to 2 decimals.",
            },
            total_shifts: {
                type: 'integer',
                description: 'Shifts this worker was assigned to in the period.',
            },
            late_days: {
                type: 'integer',
                description:
                    "Count of this worker's check-ins after the shift's scheduled date_time. No grace period.",
            },
        },
        required: ['worker_id', 'name', 'worker_type', 'hours_worked', 'total_shifts', 'late_days'],
    },
    RosterShiftEntry: {
        type: 'object',
        properties: {
            shift_id: {
                type: 'string',
                nullable: true,
                description: 'The materialized Shift\'s own _id, or null when this occurrence is still virtual (not yet materialized).',
            },
            is_virtual: {
                type: 'boolean',
                description: 'true when this occurrence is a live preview computed from the plan\'s current state, not a saved Shift document.',
            },
            plan_id: { $ref: '#/components/schemas/ObjectId' },
            location_name: { type: 'string' },
            start_time: { type: 'string', format: 'date-time' },
            duration_minutes: { type: 'integer' },
            end_time: {
                type: 'string',
                format: 'date-time',
                description: 'start_time + duration_minutes.',
            },
            status: {
                type: 'string',
                enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
                description: 'Always \'upcoming\' for a virtual occurrence.',
            },
        },
        required: [
            'shift_id',
            'is_virtual',
            'plan_id',
            'location_name',
            'start_time',
            'duration_minutes',
            'end_time',
            'status',
        ],
    },
    RosterWorkerRow: {
        type: 'object',
        properties: {
            worker_id: { $ref: '#/components/schemas/ObjectId' },
            name: { type: 'string' },
            worker_type: { type: 'string', enum: ['Employee', 'Freelancer'] },
            total_shifts_in_range: { type: 'integer' },
            total_hours_in_range: {
                type: 'number',
                description: 'Sum of duration_minutes across this worker\'s shifts in the range, in hours, rounded to 2 decimals.',
            },
            shifts_by_date: {
                type: 'object',
                description: 'Keyed by ISO date (YYYY-MM-DD) — one key per date in the requested range, value is an array (possibly empty) of that date\'s shifts for this worker.',
                additionalProperties: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/RosterShiftEntry' },
                },
            },
        },
        required: [
            'worker_id',
            'name',
            'worker_type',
            'total_shifts_in_range',
            'total_hours_in_range',
            'shifts_by_date',
        ],
    },
    ShiftRoster: {
        type: 'object',
        properties: {
            view: { type: 'string', enum: ['day', 'week', 'month'] },
            start_date: {
                type: 'string',
                format: 'date-time',
                description: 'Inclusive UTC start of the range.',
            },
            end_date: {
                type: 'string',
                format: 'date-time',
                description: 'Exclusive UTC end of the range.',
            },
            meta: {
                type: 'object',
                properties: {
                    page: { type: 'integer', description: 'Current page (1-based).' },
                    limit: { type: 'integer', description: 'Workers per page (max 100).' },
                    total: {
                        type: 'integer',
                        description: 'Total active workers matching the search/type filters, across ALL pages.',
                    },
                    totalPage: { type: 'integer' },
                    total_shifts: {
                        type: 'integer',
                        description: 'Distinct shift occurrences (materialized or virtual) in the range that include at least one worker on THIS PAGE — not a roster-wide total.',
                    },
                },
                required: ['page', 'limit', 'total', 'totalPage', 'total_shifts'],
            },
            workers: {
                type: 'array',
                description: 'This page only (size `meta.limit`, or fewer on the last page).',
                items: { $ref: '#/components/schemas/RosterWorkerRow' },
            },
        },
        required: ['view', 'start_date', 'end_date', 'meta', 'workers'],
    },
    TodayLiveShiftMeta: {
        type: 'object',
        properties: {
            today_total_shift: {
                type: 'integer',
                description: 'Materialized shifts today, system-wide — not scoped to the calling manager.',
            },
            today_total_completed_shift: {
                type: 'integer',
            },
            today_total_in_progress_shift: {
                type: 'integer',
            },
            today_total_pending_shift: {
                type: 'integer',
                description:
                    "Count of today's shifts with status 'upcoming' (not yet checked into). A cancelled shift counts toward today_total_shift but isn't reflected in today_total_completed_shift/today_total_in_progress_shift/today_total_pending_shift.",
            },
            today_total_worker_late: {
                type: 'integer',
                description:
                    "Distinct workers (not shift-assignment rows) whose shift's scheduled date_time has already passed but who still haven't checked in, excluding cancelled shifts. No grace period beyond the exact scheduled start time.",
            },
            total_issue_report: {
                type: 'integer',
                description:
                    "NOT date-scoped like the other fields — the current, system-wide count of issue reports still open (status PENDING or IN_PROGRESS), i.e. everything not yet RESOLVED, regardless of when it was filed.",
            },
        },
        required: [
            'today_total_shift',
            'today_total_completed_shift',
            'today_total_in_progress_shift',
            'today_total_pending_shift',
            'today_total_worker_late',
            'total_issue_report',
        ],
    },
    ManagerReportTrendPoint: {
        type: 'object',
        properties: {
            label: {
                type: 'string',
                description:
                    "period=week: 'Mon'..'Sun'. period=month: day-of-month as a string ('1'..'31'). period=quarter: 'Week 1', 'Week 2', ... period=year: 'Jan'..'Dec'.",
                example: 'Mon',
            },
            date: {
                type: 'string',
                format: 'date',
                description:
                    'The bucket\'s first day (YYYY-MM-DD). Omitted for period=year, where a month is the whole bucket.',
                example: '2026-09-14',
            },
            total_shift: {
                type: 'integer',
                description: 'Shifts materialized within this bucket.',
            },
        },
        required: ['label', 'total_shift'],
    },
    ManagerReport: {
        type: 'object',
        properties: {
            period: {
                type: 'string',
                enum: ['week', 'month', 'quarter', 'year'],
            },
            range: {
                type: 'object',
                description: 'The resolved [from, to] calendar range for "this" week/month/quarter/year, inclusive, UTC calendar days.',
                properties: {
                    from: { type: 'string', format: 'date', example: '2026-09-14' },
                    to: { type: 'string', format: 'date', example: '2026-09-20' },
                },
                required: ['from', 'to'],
            },
            summary: {
                type: 'object',
                properties: {
                    total_shift: {
                        type: 'integer',
                        description: 'Shifts materialized within the selected period.',
                    },
                    total_issue_report: {
                        type: 'integer',
                        description: 'Issue reports filed (any status) within the selected period — unlike TodayLiveShiftMeta.total_issue_report, this IS period-scoped.',
                    },
                },
                required: ['total_shift', 'total_issue_report'],
            },
            shift_trends: {
                type: 'array',
                description:
                    'Bucket granularity scales with the period so every chart renders a readable number of bars: week -> 1 bar/day (7), month -> 1 bar/day (28-31), quarter -> 1 bar/week (~13), year -> 1 bar/month (12). Bucket total_shift values always sum to summary.total_shift.',
                items: { $ref: '#/components/schemas/ManagerReportTrendPoint' },
            },
            issue_report_status: {
                type: 'object',
                description: 'Issue reports filed within the selected period, grouped by current status (not by when they were resolved).',
                properties: {
                    PENDING: { type: 'integer' },
                    IN_PROGRESS: { type: 'integer' },
                    RESOLVED: { type: 'integer' },
                },
                required: ['PENDING', 'IN_PROGRESS', 'RESOLVED'],
            },
        },
        required: ['period', 'range', 'summary', 'shift_trends', 'issue_report_status'],
    },
    PhotoReviewItem: {
        type: 'object',
        properties: {
            cleaning_name: {
                type: 'string',
                description: "The cleaning plan's title.",
            },
            room_name: { type: 'string' },
            task_name: { type: 'string' },
            duration_minutes: { type: 'number' },
            shift_date: {
                type: 'string',
                format: 'date-time',
                description: 'Calendar day of the shift occurrence (UTC midnight).',
            },
            location_name: { type: 'string' },
            address: { type: 'string', nullable: true },
            uploaded_photos: {
                type: 'array',
                description: 'Only the photo_requirements entries that have been uploaded for this task instance.',
                items: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        photo_url: { type: 'string' },
                    },
                    required: ['title', 'photo_url'],
                },
            },
        },
        required: [
            'cleaning_name',
            'room_name',
            'task_name',
            'duration_minutes',
            'shift_date',
            'location_name',
            'address',
            'uploaded_photos',
        ],
    },
    ShiftListItem: {
        allOf: [
            { $ref: '#/components/schemas/ShiftSummary' },
            {
                type: 'object',
                properties: {
                    total_room: { type: 'integer' },
                    completed_room: {
                        type: 'integer',
                        description: 'Count of rooms at progress_percent 100.',
                    },
                    total_task: { type: 'integer' },
                    overall_progress_percent: {
                        type: 'integer',
                        minimum: 0,
                        maximum: 100,
                    },
                    cleaning_plan: {
                        type: 'object',
                        properties: {
                            _id: { $ref: '#/components/schemas/ObjectId' },
                            title: { type: 'string', nullable: true },
                        },
                    },
                    client: {
                        type: 'object',
                        nullable: true,
                        properties: {
                            _id: { $ref: '#/components/schemas/ObjectId' },
                            name: { type: 'string' },
                        },
                    },
                },
            },
        ],
        description:
            'Lean list-view shape: ShiftSummary plus progress totals and resolved cleaning_plan/client context — no rooms[]/tasks[]/assigned_workers[] detail. Used by today-live-shifts; use GET /shift/single-live-shift/{id} for full detail on one shift.',
    },
    ShiftDetail: {
        type: 'object',
        properties: {
            _id: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                example: '507f1f77bcf86cd799439011',
            },
            cleaning_plan: {
                type: 'object',
                properties: {
                    _id: { $ref: '#/components/schemas/ObjectId' },
                    title: { type: 'string', nullable: true },
                },
            },
            client: {
                type: 'object',
                nullable: true,
                properties: {
                    _id: { $ref: '#/components/schemas/ObjectId' },
                    name: { type: 'string' },
                },
            },
            date: {
                type: 'string',
                format: 'date-time',
            },
            date_time: {
                type: 'string',
                format: 'date-time',
            },
            status: {
                type: 'string',
                enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
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
                    },
                },
            },
            duration_minutes: {
                type: 'number',
            },
            rooms: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        room: { $ref: '#/components/schemas/ObjectId' },
                        name: { type: 'string' },
                        room_type: { type: 'string' },
                        total_task: { type: 'integer' },
                        completed_task: { type: 'integer' },
                        progress_percent: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 100,
                        },
                    },
                },
                description: "Snapshot of the plan's rooms, with per-room progress fields appended.",
            },
            tasks: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        task: { $ref: '#/components/schemas/ObjectId' },
                        room: { allOf: [{ $ref: '#/components/schemas/ObjectId' }], nullable: true },
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
                        },
                        is_completed: { type: 'boolean' },
                        completed_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                        },
                        source: {
                            type: 'string',
                            enum: ['plan_task', 'additional_task'],
                        },
                    },
                },
            },
            assigned_workers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        worker: { $ref: '#/components/schemas/ObjectId' },
                        name: { type: 'string' },
                        role: {
                            type: 'string',
                            enum: ['Team leader', 'Co-leader', 'Normal worker'],
                        },
                        assigned_with_conflict: { type: 'boolean' },
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
                        },
                    },
                },
            },
            is_worker_overridden: {
                type: 'boolean',
            },
            last_updated_by: {
                $ref: '#/components/schemas/ObjectId',
                nullable: true,
            },
            createdAt: {
                type: 'string',
                format: 'date-time',
            },
            updatedAt: {
                type: 'string',
                format: 'date-time',
            },
            total_room: { type: 'integer' },
            completed_room: {
                type: 'integer',
                description: 'Count of rooms at progress_percent 100.',
            },
            total_task: { type: 'integer' },
            overall_progress_percent: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
            },
        },
        description:
            'Full single-shift detail: everything Shift has (rooms[] with per-room progress fields appended, tasks[], assigned_workers[]) plus resolved cleaning_plan/client context and overall progress totals. Returned by GET /shift/single-live-shift/{id}.',
    },
    InvoiceCreate: {
        type: 'object',
        properties: {
            worker: {
                $ref: '#/components/schemas/ObjectId',
            },
            amount: {
                type: 'number',
                exclusiveMinimum: 0,
                example: 150.5,
            },
            payment_method: {
                type: 'string',
                minLength: 1,
                example: 'Bank Transfer',
            },
            transaction_id: {
                type: 'string',
                example: 'TXN-2026-0912-001',
            },
            notes: {
                type: 'string',
                example: 'September payout',
            },
        },
        required: ['worker', 'amount', 'payment_method'],
    },
    Invoice: {
        type: 'object',
        properties: {
            _id: {
                $ref: '#/components/schemas/ObjectId',
            },
            manager: {
                oneOf: [
                    { $ref: '#/components/schemas/ObjectId' },
                    {
                        type: 'object',
                        properties: {
                            _id: { $ref: '#/components/schemas/ObjectId' },
                        },
                    },
                ],
                description:
                    'ObjectId on writes; populated document on reads.',
            },
            worker: {
                oneOf: [
                    { $ref: '#/components/schemas/ObjectId' },
                    {
                        type: 'object',
                        properties: {
                            _id: { $ref: '#/components/schemas/ObjectId' },
                        },
                    },
                ],
                description:
                    'ObjectId on writes; populated document on reads.',
            },
            amount: {
                type: 'number',
                exclusiveMinimum: 0,
                example: 150.5,
            },
            payment_method: {
                type: 'string',
                minLength: 1,
                example: 'Bank Transfer',
            },
            transaction_id: {
                type: 'string',
                nullable: true,
                example: 'TXN-2026-0912-001',
            },
            notes: {
                type: 'string',
                nullable: true,
                example: 'September payout',
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
    ChatAttachment: {
        type: 'object',
        properties: {
            url: { type: 'string' },
            type: {
                type: 'string',
                enum: ['image', 'video', 'pdf', 'file'],
            },
        },
        required: ['url', 'type'],
    },
    Chat: {
        type: 'object',
        properties: {
            _id: { $ref: '#/components/schemas/ObjectId' },
            type: {
                type: 'string',
                enum: ['group', 'direct', 'worker', 'client'],
                description:
                    "'group' = one chat per cleaning plan, auto-membership of the client + every currently-assigned worker, visible to all managers. 'direct' = a 1:1 client↔worker chat, modeled as a chat with a single-element workers array and no cleaning_plan/name. 'worker' = one chat per worker (created automatically with the worker profile), auto-membership of that one worker + every manager, no client at all. 'client' = one chat per client (created automatically with the client profile), auto-membership of that one client + every manager, no workers at all. Both 'worker' and 'client' — see display_name below for how their names work.",
            },
            cleaning_plan: {
                $ref: '#/components/schemas/ObjectId',
                nullable: true,
                description: 'group chats only; null for every other type.',
            },
            name: {
                type: 'string',
                nullable: true,
                description:
                    "group chats only (set to the cleaning plan title); null for every other type. Prefer display_name (below) for showing a name to the user — it's correct for all four chat types.",
            },
            display_name: {
                type: 'string',
                nullable: true,
                description:
                    "Computed per viewer, not stored — present on GET /chat/my-chats and GET /chat/{id}/members results only (not on write responses). For 'group' chats: the plan title (same as name). For 'worker' chats: 'Managers' when the caller is the worker, or the worker's own name when the caller is a manager. For 'client' chats: 'Manager' when the caller is the client, or the client's own name when the caller is a manager. Always null for 'direct' chats currently.",
            },
            client: {
                oneOf: [
                    { $ref: '#/components/schemas/ObjectId' },
                    {
                        type: 'object',
                        properties: {
                            _id: { $ref: '#/components/schemas/ObjectId' },
                            name: { type: 'string' },
                            email: { type: 'string', format: 'email' },
                            phone: { type: 'string' },
                        },
                    },
                ],
                nullable: true,
                description:
                    "ObjectId on writes; populated (name/email/phone) on list/detail reads. The one client for 'client' chats; always null for 'worker' chats — they have no client.",
            },
            workers: {
                type: 'array',
                items: {
                    oneOf: [
                        { $ref: '#/components/schemas/ObjectId' },
                        {
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
                    ],
                },
                description:
                    "Group: every currently-assigned worker. Direct: the single other party. Worker: the one worker this chat belongs to (array of length 1). Client: always empty — no workers involved. ObjectIds on writes; populated on list/detail reads.",
            },
            participant_key: {
                type: 'string',
                nullable: true,
                description:
                    "direct chats only — sorted `${clientId}:${workerId}`, used to find-or-create idempotently. Always null for group chats.",
            },
            last_message: {
                oneOf: [
                    { $ref: '#/components/schemas/ObjectId' },
                    { $ref: '#/components/schemas/ChatMessage' },
                ],
                nullable: true,
                description: 'ObjectId on writes; populated (with its own sender) on list reads.',
            },
            last_message_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            last_updated_by: {
                $ref: '#/components/schemas/ObjectId',
                nullable: true,
            },
            is_active: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
        },
        description:
            'A chat room — a group chat auto-tied to a CleaningPlan, a 1:1 direct chat between a client and a worker, a worker↔managers chat auto-created with the worker profile, or a client↔managers chat auto-created with the client profile. See docs/CHAT_SOCKET_EVENTS.md for how messages are actually sent (Socket.IO only — there is no REST endpoint to create a message).',
    },
    ChatMessage: {
        type: 'object',
        properties: {
            _id: { $ref: '#/components/schemas/ObjectId' },
            chat: { $ref: '#/components/schemas/ObjectId' },
            sender: {
                oneOf: [
                    { $ref: '#/components/schemas/ObjectId' },
                    {
                        type: 'object',
                        properties: {
                            _id: { $ref: '#/components/schemas/ObjectId' },
                            full_name: { type: 'string' },
                            profile_photo: { type: 'string', nullable: true },
                            email: { type: 'string', format: 'email' },
                        },
                    },
                ],
                description:
                    "The sending User account's id (not the client/worker/manager profile id) — populated (full_name/profile_photo/email) on reads.",
            },
            sender_role: {
                type: 'string',
                enum: ['client', 'worker', 'manager'],
            },
            text: { type: 'string' },
            attachments: {
                type: 'array',
                items: { $ref: '#/components/schemas/ChatAttachment' },
            },
            seen: {
                type: 'boolean',
                description:
                    'Only meaningful for direct chats — group chats have more than one recipient, so a single boolean cannot represent "seen" for them.',
            },
            is_deleted: {
                type: 'boolean',
                description: 'Soft-delete flag — set via DELETE /chat-message/{id} or the group:delete-message socket event; the document is never actually removed.',
            },
            deleted_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
        },
        description:
            'Created only via Socket.IO (group:send-message / send-message events) — there is no REST endpoint to create a message. See docs/CHAT_SOCKET_EVENTS.md.',
    },
};
export default {
    ...schemas,
    ...chatSchemas,
    MyShift: {
        ...schemas.Shift,
        properties: {
            ...schemas.Shift.properties,
            cleaning_plan: {
                type: 'object',
                properties: {
                    _id: { $ref: '#/components/schemas/ObjectId' },
                    title: { type: 'string', nullable: true, example: 'Daily Office Cleaning' },
                },
                required: ['_id', 'title'],
            },
        },
    },
    AdditionalTaskDetail: {
        ...schemas.AdditionalTask,
        properties: {
            ...schemas.AdditionalTask.properties,
            cleaning_plan_id: {
                $ref: '#/components/schemas/CleaningPlan',
            },
        },
    },
};
