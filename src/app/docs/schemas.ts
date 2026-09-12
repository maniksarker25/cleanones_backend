// Shared OpenAPI 3.0 schemas. Keep in sync with validation, models and services.
const schemas = {
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
            is_active: {
                type: 'boolean',
            },
            location: {
                $ref: '#/components/schemas/Point',
            },
        },
        required: ['client', 'name', 'address'],
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
            floor: {
                type: 'number',
                example: 2,
            },
            is_active: {
                type: 'boolean',
            },
        },
        required: ['location', 'name', 'room_type'],
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
};
export default schemas;
