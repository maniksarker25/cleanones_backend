// Reviewed HTTP contracts; keep aligned with routes, controllers and services.
import userPaths from './user.paths';
import questionSuggestionPaths from './question_suggestion.paths';
import issueReportPaths from './issue_report.paths';
import clientContactPaths from './client_contact.paths';
const errors = {
    '400': {
        description: 'Invalid ID, model validation, or business rule failure.',
        content: {
            'application/json': {
                schema: {
                    $ref: '#/components/schemas/Error',
                },
            },
        },
    },
    '401': {
        description: 'Missing, invalid, expired token, or role not allowed.',
        content: {
            'application/json': {
                schema: {
                    $ref: '#/components/schemas/Error',
                },
            },
        },
    },
    '403': {
        description: 'Account is blocked or inactive, or credentials rejected.',
        content: {
            'application/json': {
                schema: {
                    $ref: '#/components/schemas/Error',
                },
            },
        },
    },
    '404': {
        description: 'Resource or authenticated profile not found.',
        content: {
            'application/json': {
                schema: {
                    $ref: '#/components/schemas/Error',
                },
            },
        },
    },
    '429': {
        description: 'Rate limit exceeded. Respect Retry-After.',
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
            'Server error. Current global error handler also returns 500 for Zod validation failures.',
        content: {
            'application/json': {
                schema: {
                    $ref: '#/components/schemas/Error',
                },
            },
        },
    },
};
const paths = {
    ...questionSuggestionPaths,
    ...issueReportPaths,
    ...clientContactPaths,
    ...userPaths,
    '/client/create-client': {
        post: {
            ...{
                tags: ['Clients'],
                summary: 'Create client',
                operationId: 'postClientCreateClient',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Creates a user and client profile in a MongoDB transaction and emails login credentials. Passwords must match.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ClientCreate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Client',
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
    },
    '/client/update-client/{id}': {
        patch: {
            ...{
                tags: ['Clients'],
                summary: 'Update client',
                operationId: 'patchClientUpdateClientId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update. \n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ClientUpdate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Client',
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
    },
    '/client/delete-client/{id}': {
        delete: {
            ...{
                tags: ['Clients'],
                summary: 'Deactivate client',
                operationId: 'deleteClientDeleteClientId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Soft-deletes the client and marks its user deleted and blocked. Returns null.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/client/all-clients': {
        get: {
            ...{
                tags: ['Clients'],
                summary: 'List clients',
                operationId: 'getClientAllClients',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result.  Excludes deleted clients.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, email, phone, company_name.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Comma-separated fields, for example name,email.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Client',
                                                    },
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
    },
    '/location/create-location': {
        post: {
            ...{
                tags: ['Locations'],
                summary: 'Create location',
                operationId: 'postLocationCreateLocation',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Client must exist and not be deleted.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/LocationCreate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Location',
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
    },
    '/location/update-location/{id}': {
        patch: {
            ...{
                tags: ['Locations'],
                summary: 'Update location',
                operationId: 'patchLocationUpdateLocationId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update. \n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/LocationUpdate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Location',
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
    },
    '/location/delete-location/{id}': {
        delete: {
            ...{
                tags: ['Locations'],
                summary: 'Deactivate location',
                operationId: 'deleteLocationDeleteLocationId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Sets is_active=false and returns the updated document. Does not cascade to child records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Location',
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
    },
    '/location/all-locations': {
        get: {
            ...{
                tags: ['Locations'],
                summary: 'List locations',
                operationId: 'getLocationAllLocations',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result. fields projection is not implemented for this aggregation endpoint. Defaults to active records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, address.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Location',
                                                    },
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
    },
    '/location/single-location/{id}': {
        get: {
            ...{
                tags: ['Locations'],
                summary: 'Get location',
                operationId: 'getLocationSingleLocationId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Includes populated references. The service does not exclude inactive records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Location',
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
    },
    '/location/my-locations': {
        get: {
            ...{
                tags: ['Locations'],
                summary: 'My locations',
                operationId: 'getLocationMyLocations',
                description:
                    "Client-only. Returns locations belonging to the authenticated client. Pagination is nested under data.meta; records are under data.result.\n\nRequired role: client.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['client'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, address.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Location',
                                                    },
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
    },
    '/room/create-room': {
        post: {
            ...{
                tags: ['Rooms'],
                summary: 'Create room',
                operationId: 'postRoomCreateRoom',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. The location must be active.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RoomCreate' },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Room',
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
    },
    '/room/update-room/{id}': {
        patch: {
            ...{
                tags: ['Rooms'],
                summary: 'Update room',
                operationId: 'patchRoomUpdateRoomId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update. \n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RoomUpdate' },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Room',
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
    },
    '/room/delete-room/{id}': {
        delete: {
            ...{
                tags: ['Rooms'],
                summary: 'Deactivate room',
                operationId: 'deleteRoomDeleteRoomId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Sets is_active=false and returns the updated document. Does not cascade to child records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Room',
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
    },
    '/room/all-rooms': {
        get: {
            ...{
                tags: ['Rooms'],
                summary: 'List all rooms',
                operationId: 'getRoomAllRooms',
                description:
                    "Manager-only. Unscoped room listing across all locations, filterable by location and client. Pagination is nested under data.meta; records are under data.result. Defaults to active records.\n\nRequired role: manager.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'location',
                        in: 'query',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                        description: 'Filter rooms belonging to this location.',
                    },
                    {
                        name: 'client',
                        in: 'query',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                        description:
                            "Filter rooms whose location belongs to this client.",
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, room_type, cleaning_type.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Room',
                                                    },
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
    },
    '/room/all-rooms/{locationId}': {
        get: {
            ...{
                tags: ['Rooms'],
                summary: 'List rooms',
                operationId: 'getRoomAllRoomsLocationId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result. fields projection is not implemented for this aggregation endpoint. Defaults to active records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'locationId',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, room_type.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Room',
                                                    },
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
    },
    '/room/single-room/{id}': {
        get: {
            ...{
                tags: ['Rooms'],
                summary: 'Get room',
                operationId: 'getRoomSingleRoomId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Includes populated references. The service does not exclude inactive records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Room',
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
    },
    '/room/my-rooms/{locationId}': {
        get: {
            ...{
                tags: ['Rooms'],
                summary: 'My rooms',
                operationId: 'getRoomMyRoomsLocationId',
                description:
                    "Client-only. locationId must be one of the client's own locations, otherwise 404 Location not found. Pagination is nested under data.meta; records are under data.result.\n\nRequired role: client.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['client'],
                parameters: [
                    {
                        name: 'locationId',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, room_type, cleaning_type.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Room',
                                                    },
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
    },
    '/task/create-task': {
        post: {
            ...{
                tags: ['Tasks'],
                summary: 'Create task',
                operationId: 'postTaskCreateTask',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. The room and its location must be active.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/TaskCreate' },
                            example: {
                                room: '507f1f77bcf86cd799439011',
                                name: 'Clean meeting table',
                                frequency_type: 'weekly',
                                days_of_week: ['mon', 'fri'],
                                is_photo_required: true,
                                photo_requirements: [
                                    {
                                        title: 'Before cleaning',
                                        photo_url: null,
                                        is_uploaded: false,
                                    },
                                    {
                                        title: 'After cleaning',
                                        photo_url: null,
                                        is_uploaded: false,
                                    },
                                ],
                                duration_minutes: 15,
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Task',
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
    },
    '/task/update-task/{id}': {
        patch: {
            ...{
                tags: ['Tasks'],
                summary: 'Update task',
                operationId: 'patchTaskUpdateTaskId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update. When changing to weekly/monthly, supply the corresponding nonempty schedule array.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/TaskUpdate' },
                            example: {
                                is_photo_required: true,
                                photo_requirements: [
                                    {
                                        title: 'Before cleaning',
                                        photo_url: null,
                                        is_uploaded: false,
                                    },
                                    {
                                        title: 'After cleaning',
                                        photo_url: null,
                                        is_uploaded: false,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Task',
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
    },
    '/task/delete-task/{id}': {
        delete: {
            ...{
                tags: ['Tasks'],
                summary: 'Deactivate task',
                operationId: 'deleteTaskDeleteTaskId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Sets is_active=false and returns the updated document. Does not cascade to child records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Task',
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
    },
    '/task/all-tasks/{roomId}': {
        get: {
            ...{
                tags: ['Tasks'],
                summary: 'List tasks',
                operationId: 'getTaskAllTasksRoomId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result.  Defaults to active records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'roomId',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Comma-separated fields, for example name,email.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Task',
                                                    },
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
    },
    '/task/single-task/{id}': {
        get: {
            ...{
                tags: ['Tasks'],
                summary: 'Get task',
                operationId: 'getTaskSingleTaskId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Includes populated references. The service does not exclude inactive records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Task',
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
    },
    '/task/my-tasks/{roomId}': {
        get: {
            ...{
                tags: ['Tasks'],
                summary: 'My tasks',
                operationId: 'getTaskMyTasksRoomId',
                description:
                    "Client-only. roomId must be inside one of the client's own locations, otherwise 404 Room not found. Pagination is nested under data.meta; records are under data.result.\n\nRequired role: client.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['client'],
                parameters: [
                    {
                        name: 'roomId',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Case-insensitive regex search across name.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Task',
                                                    },
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
    },
    '/worker/my-availability': {
        patch: {
            ...{
                tags: ['Workers'],
                summary: "Update the caller's availability",
                operationId: 'patchWorkerMyAvailability',
                description:
                    'Only active Freelancer-type workers can update their own availability; other workers receive 403.\n\nRequired role: worker.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
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
                                },
                                required: ['working_days'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Worker',
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
    },
    '/worker/create-worker': {
        post: {
            ...{
                tags: ['Workers'],
                summary: 'Create worker',
                operationId: 'postWorkerCreateWorker',
                description:
                    'Creates a user and worker profile in a MongoDB transaction. Rejects duplicate email or phone. working_days may only be supplied for Employee-type workers.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WorkerCreate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Worker',
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
    },
    '/worker/update-worker/{id}': {
        patch: {
            ...{
                tags: ['Workers'],
                summary: 'Update worker',
                operationId: 'patchWorkerUpdateWorkerId',
                description:
                    'Partial update. Rejects duplicate email or phone. working_days may only be set when the target worker is Employee-type.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WorkerUpdate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Worker',
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
    },
    '/worker/delete-worker/{id}': {
        delete: {
            ...{
                tags: ['Workers'],
                summary: 'Soft-delete worker',
                operationId: 'deleteWorkerDeleteWorkerId',
                description:
                    'Soft-deletes the worker profile and marks its linked user deleted and blocked. Returns null.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/worker/all-workers': {
        get: {
            ...{
                tags: ['Workers'],
                summary: 'List workers',
                operationId: 'getWorkerAllWorkers',
                description:
                    'Pagination is nested under data.meta; records are under data.result. Excludes soft-deleted workers (including legacy records missing isDeleted).\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, email, phone, position, nationality.',
                    },
                    {
                        name: 'worker_type',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: ['Employee', 'Freelancer'],
                        },
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: [
                                'created_at',
                                '-created_at',
                                'email',
                                '-email',
                                'hourly_rate',
                                '-hourly_rate',
                            ],
                            default: '-created_at',
                        },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Worker',
                                                    },
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
    },
    '/worker/single-worker/{id}': {
        get: {
            ...{
                tags: ['Workers'],
                summary: 'Get worker',
                operationId: 'getWorkerSingleWorkerId',
                description:
                    'Excludes soft-deleted workers.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Worker',
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
    },
    '/cleaning-plan/create-cleaning-plan': {
        post: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'Create cleaning plan',
                operationId: 'postCleaningPlanCreateCleaningPlan',
                description:
                    'manager and last_updated_by are set from the authenticated manager profile. Client must exist and not be deleted; location must be active.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/CleaningPlanCreate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '201': {
                        description: 'Cleaning plan created.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/CleaningPlan',
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
    },
    '/cleaning-plan/update-cleaning-plan/{id}': {
        patch: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'Update cleaning plan',
                operationId: 'patchCleaningPlanUpdateCleaningPlanId',
                description:
                    'Partial update. last_updated_by is set from the authenticated manager profile. Parent client/location cannot be changed through the documented update contract.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/CleaningPlanUpdate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/CleaningPlan',
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
    },
    '/cleaning-plan/delete-cleaning-plan/{id}': {
        delete: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'Deactivate cleaning plan',
                operationId: 'deleteCleaningPlanDeleteCleaningPlanId',
                description:
                    'Sets is_active=false and last_updated_by, and returns the updated document. Does not cascade to child additional tasks.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/CleaningPlan',
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
    },
    '/cleaning-plan/get-my-cleaning-plans': {
        get: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'Get my cleaning plans',
                operationId: 'getMyCleaningPlans',
                description:
                    'Pagination is nested under data.meta; records are under data.result. Returns only active plans belonging to the authenticated client. rooms, assigned_workers and additional_tasks are omitted from list results, replaced by total_room, total_assigned_worker and total_additional_task counts. Supports page, limit, searchTerm, sort and an optional location ObjectId filter. Other query keys are ignored; client ownership and active status cannot be overridden.\n\nRequired role: client.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['client'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across title, description.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/CleaningPlan',
                                                    },
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
    },
    '/cleaning-plan/all-cleaning-plans': {
        get: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'List cleaning plans',
                operationId: 'getCleaningPlanAllCleaningPlans',
                description:
                    'Pagination is nested under data.meta; records are under data.result. Defaults to active plans. rooms, assigned_workers and additional_tasks are omitted from list results, replaced by total_room, total_assigned_worker and total_additional_task counts. Any unrecognized query key is applied as an equality filter on the underlying collection, so pass query parameters carefully.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across title, description.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/CleaningPlan',
                                                    },
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
    },
    '/cleaning-plan/single-cleaning-plan/{id}': {
        get: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'Get cleaning plan',
                operationId: 'getCleaningPlanSingleCleaningPlanId',
                description:
                    'Includes populated references, full rooms/assigned_workers/additional_tasks documents, and single-plan aggregation totals. The service does not exclude inactive records.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/CleaningPlan',
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
    },
    '/cleaning-plan/{id}/eligible-workers': {
        get: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'List eligible workers with conflict flags',
                operationId: 'getCleaningPlanIdEligibleWorkers',
                description:
                    'Returns active, non-blocked workers for this plan, each with is_conflict/conflict_reason/conflicting_plan_id computed against the plan\'s date_time, end_date and the recurrence (frequency_type/days_of_week/days_of_month) of the active tasks on the plan\'s rooms. Excludes this plan itself from the conflict search. Ineligible workers (deleted/blocked/inactive) are omitted entirely rather than flagged.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    worker: {
                                                        type: 'object',
                                                    },
                                                    is_conflict: {
                                                        type: 'boolean',
                                                    },
                                                    conflict_reason: {
                                                        type: 'string',
                                                        enum: ['double_booked'],
                                                        nullable: true,
                                                    },
                                                    conflicting_plan_id: {
                                                        $ref: '#/components/schemas/ObjectId',
                                                        nullable: true,
                                                    },
                                                },
                                            },
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
    },
    '/cleaning-plan/{id}/assign-workers': {
        patch: {
            ...{
                tags: ['Cleaning plans'],
                summary: 'Assign workers to a cleaning plan',
                operationId: 'patchCleaningPlanIdAssignWorkers',
                description:
                    'Replaces assigned_workers. Ineligible workers (deleted/blocked/inactive) are always rejected with 400. When one or more submitted workers has a scheduling conflict, the request is rejected with 409 (body.errorDetails.conflicts lists the offending workers) unless force=true, in which case those entries are saved with assigned_with_conflict=true for audit purposes.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'force',
                        in: 'query',
                        schema: { type: 'boolean' },
                        description:
                            'Alternative to force in the body; assign despite scheduling conflicts.',
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    assigned_workers: {
                                        type: 'array',
                                        minItems: 1,
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
                                    force: { type: 'boolean' },
                                },
                                required: ['assigned_workers'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/CleaningPlan',
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
    },
    '/additional-task/create-additional-task': {
        post: {
            ...{
                tags: ['Additional tasks'],
                summary: 'Create additional task',
                operationId: 'postAdditionalTaskCreateAdditionalTask',
                description:
                    'The referenced cleaning plan must exist and be active. The new task ID is pushed onto the plan\'s additional_tasks array. is_completed is forced to false.\n\nRequired role: client or manager. Manager-created tasks are automatically approved (is_approved: true); client-created tasks require approval (is_approved: false). Approval is determined by the authenticated role and cannot be overridden by the request body.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['client', 'manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AdditionalTaskCreate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '201': {
                        description: 'Additional task created. Manager: automatically approved. Client: awaiting approval.',
                        content: {
                            'application/json': {
                                examples: {
                                    managerCreated: {
                                        summary: 'Manager creates an approved task',
                                        value: {
                                            success: true,
                                            message: 'Additional task created successfully',
                                            data: {
                                                _id: '507f1f77bcf86cd799439012',
                                                cleaning_plan_id: '507f1f77bcf86cd799439011',
                                                name: 'Clean entrance windows',
                                                duration_minutes: 20,
                                                date_time: '2026-09-13T09:00:00.000Z',
                                                is_completed: false,
                                                is_approved: true,
                                            },
                                        },
                                    },
                                    clientCreated: {
                                        summary: 'Client creates a task awaiting approval',
                                        value: {
                                            success: true,
                                            message: 'Additional task created successfully',
                                            data: {
                                                _id: '507f1f77bcf86cd799439012',
                                                cleaning_plan_id: '507f1f77bcf86cd799439011',
                                                name: 'Clean entrance windows',
                                                duration_minutes: 20,
                                                date_time: '2026-09-13T09:00:00.000Z',
                                                is_completed: false,
                                                is_approved: false,
                                            },
                                        },
                                    },
                                },
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AdditionalTask',
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
    },
    '/additional-task/update-additional-task/{id}': {
        patch: {
            ...{
                tags: ['Additional tasks'],
                summary: 'Update additional task',
                operationId: 'patchAdditionalTaskUpdateAdditionalTaskId',
                description:
                    'Partial update. is_approved is stripped from the payload even if supplied; use the approve endpoint instead.\n\nRequired role: client.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['client'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AdditionalTaskUpdate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AdditionalTask',
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
    },
    '/additional-task/delete-additional-task/{id}': {
        delete: {
            ...{
                tags: ['Additional tasks'],
                summary: 'Delete additional task',
                operationId: 'deleteAdditionalTaskDeleteAdditionalTaskId',
                description:
                    "Permanently deletes the task and pulls its ID from the parent cleaning plan's additional_tasks array. Unlike most delete endpoints in this API, the response data is a status message object, not the deleted document or null.\n\nRequired role: client.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['client'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                message: { type: 'string' },
                                            },
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
    },
    '/additional-task/approve-additional-task/{id}': {
        patch: {
            ...{
                tags: ['Additional tasks'],
                summary: 'Approve or reject additional task',
                operationId: 'patchAdditionalTaskApproveAdditionalTaskId',
                description: 'Required role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    is_approved: { type: 'boolean' },
                                },
                                required: ['is_approved'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AdditionalTask',
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
    },
    '/additional-task/all-additional-tasks': {
        get: {
            ...{
                tags: ['Additional tasks'],
                summary: 'List additional tasks',
                operationId: 'getAdditionalTaskAllAdditionalTasks',
                description:
                    'Without planId, managers can list all additional tasks; clients can list tasks only from their own active plans. With planId, clients must own the selected plan. Pagination is nested under data.meta; records are under data.result. Boolean filters is_approved, is_completed and is_photo_required accept true or false. Unknown query keys are ignored. Invalid query values return 400.\n\nRequired role: manager, client.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager', 'client'],
                parameters: [
                    {
                        name: 'is_approved',
                        in: 'query',
                        required: false,
                        description: 'Send true for approved tasks or false for tasks not approved. Omit to include both. Strings are converted to booleans; invalid values return 400.',
                        schema: { type: 'string', enum: ['true', 'false'] },
                        examples: {
                            approved: { value: 'true' },
                            notApproved: { value: 'false' },
                        },
                    },
                    {
                        name: 'planId',
                        in: 'query',
                        required: false,
                        description: 'Optional cleaning plan ID. The plan must exist and be active.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, description.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/AdditionalTask',
                                                    },
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
    },
    '/additional-task/single-additional-task/{id}': {
        get: {
            ...{
                tags: ['Additional tasks'],
                summary: 'Get additional task',
                operationId: 'getAdditionalTaskSingleAdditionalTaskId',
                description: 'Required role: manager, client. cleaning_plan_id contains the full cleaning plan detail response, including populated client, location, rooms, assigned worker profiles, additional tasks, manager and last_updated_by, plus totals. Manager profiles exclude user. Returns 404 if the task or cleaning plan does not exist.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager', 'client'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AdditionalTaskDetail',
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
    },
    '/location/client-locations/{clientId}': {
        get: {
            ...{
                tags: ['Locations'],
                summary: "List a client's locations",
                operationId: 'getLocationClientLocationsClientId',
                description:
                    'Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Returns data.meta and data.result, with total_room on each location. fields projection is not implemented.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'clientId',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, address.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Location',
                                                    },
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
    },
    '/location/worker-locations/{workerId}': {
        get: {
            ...{
                tags: ['Locations'],
                summary: "List a worker's locations",
                operationId: 'getLocationWorkerLocationsWorkerId',
                description:
                    "Manager-only. Every location a worker is currently working — derived from the distinct location of the worker's active, non-completed cleaning plans (not a direct relation on Location/Worker). Returns data.meta and data.result, with total_room on each location.\n\nRequired role: manager.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'workerId',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across name, address.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: 'created_at' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Location',
                                                    },
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
    },
    '/auth/login': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Log in',
                operationId: 'postAuthLogin',
                description:
                    'Returns accessToken, refreshToken and role. Sets an HttpOnly refreshToken cookie (SameSite=Strict, Secure in production, seven-day max age). Auth routes share a limit of three requests per minute per email or IP.',
                security: [],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Login' },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Tokens',
                                        },
                                    },
                                    required: ['success', 'message'],
                                },
                            },
                        },
                        headers: {
                            'Set-Cookie': {
                                description:
                                    'refreshToken=<token>; HttpOnly; SameSite=Strict; Secure in production',
                                schema: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    },
    '/auth/change-password': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Change password',
                operationId: 'postAuthChangePassword',
                description:
                    'New passwords must match. Auth routes share a limit of three requests per minute per email or IP.\n\nRequired role: client, worker, admin, superAdmin.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['client', 'worker', 'admin', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ChangePassword',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/auth/refresh-token': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Refresh access token',
                operationId: 'postAuthRefreshToken',
                description:
                    'Uses the HttpOnly refreshToken cookie set by login; no JSON body. Browser cookies are sent automatically on the same origin. Auth routes share a limit of three requests per minute per email or IP.',
                security: [{ refreshCookie: [] }],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Tokens',
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
    },
    '/auth/forget-password': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Request password reset code',
                operationId: 'postAuthForgetPassword',
                description:
                    'Sends a reset code by email, valid for five minutes. Auth routes share a limit of three requests per minute per email or IP.',
                security: [],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/EmailRequest',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/auth/verify-reset-otp': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Verify reset code',
                operationId: 'postAuthVerifyResetOtp',
                description:
                    'Call after requesting the code, before resetting the password. Auth routes share a limit of three requests per minute per email or IP.',
                security: [],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/VerifyResetOtp',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/auth/reset-password': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Reset password',
                operationId: 'postAuthResetPassword',
                description:
                    'Requires prior reset-code verification. Passwords must match. Returns tokens in the response body; does not set a cookie. Auth routes share a limit of three requests per minute per email or IP.',
                security: [],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ResetPassword',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Tokens',
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
    },
    '/auth/resend-reset-code': {
        post: {
            ...{
                tags: ['Authentication'],
                summary: 'Resend password reset code',
                operationId: 'postAuthResendResetCode',
                description:
                    'Accepts a flat email field. The unused nested-email validator is not mounted. Auth routes share a limit of three requests per minute per email or IP.',
                security: [],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/EmailRequest',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/auth/all-user': {
        get: {
            ...{
                tags: ['Authentication'],
                summary: 'List users (legacy)',
                operationId: 'getAuthAllUser',
                description:
                    'Current route has no authentication middleware and returns User.find() results. The user response contract is unfinished; review access and returned fields before deployment.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {},
                                            },
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
    },
    '/manage/get-about-us': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get about-us',
                operationId: 'getManageGetAboutUs',
                description:
                    'Public content. Returns the first document, or null if absent.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                description: {
                                                    type: 'string',
                                                    example:
                                                        'About our company.',
                                                },
                                                _id: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
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
                                            nullable: true,
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
    },
    '/manage/add-about-us': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add about-us',
                operationId: 'postManageAddAboutUs',
                description:
                    'Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AboutUsInput',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AboutUs',
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
    },
    '/manage/edit-about-us/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit about-us',
                operationId: 'patchManageEditAboutUsId',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    description: {
                                        type: 'string',
                                        example: 'About our company.',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AboutUs',
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
    },
    '/manage/delete-about-us/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete about-us',
                operationId: 'deleteManageDeleteAboutUsId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/AboutUs',
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
    },
    '/manage/get-privacy-policy': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get privacy-policy',
                operationId: 'getManageGetPrivacyPolicy',
                description:
                    'Public content. Returns the first document, or null if absent.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                description: {
                                                    type: 'string',
                                                    example:
                                                        'Privacy policy text.',
                                                },
                                                _id: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
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
                                            nullable: true,
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
    },
    '/manage/add-privacy-policy': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add privacy-policy',
                operationId: 'postManageAddPrivacyPolicy',
                description:
                    'Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/PrivacyPolicyInput',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/PrivacyPolicy',
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
    },
    '/manage/edit-privacy-policy/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit privacy-policy',
                operationId: 'patchManageEditPrivacyPolicyId',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    description: {
                                        type: 'string',
                                        example: 'Privacy policy text.',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/PrivacyPolicy',
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
    },
    '/manage/delete-privacy-policy/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete privacy-policy',
                operationId: 'deleteManageDeletePrivacyPolicyId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/PrivacyPolicy',
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
    },
    '/manage/get-terms-conditions': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get terms-conditions',
                operationId: 'getManageGetTermsConditions',
                description:
                    'Public content. Returns the first document, or null if absent.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                description: {
                                                    type: 'string',
                                                    example:
                                                        'Terms and conditions.',
                                                },
                                                _id: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
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
                                            nullable: true,
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
    },
    '/manage/add-terms-conditions': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add terms-conditions',
                operationId: 'postManageAddTermsConditions',
                description:
                    'Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/TermsConditionsInput',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/TermsConditions',
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
    },
    '/manage/edit-terms-conditions/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit terms-conditions',
                operationId: 'patchManageEditTermsConditionsId',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    description: {
                                        type: 'string',
                                        example: 'Terms and conditions.',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/TermsConditions',
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
    },
    '/manage/delete-terms-conditions/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete terms-conditions',
                operationId: 'deleteManageDeleteTermsConditionsId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/TermsConditions',
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
    },
    '/manage/get-partner': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get partner',
                operationId: 'getManageGetPartner',
                description:
                    'Public content. Returns the first document, or null if absent.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                description: {
                                                    type: 'string',
                                                    example:
                                                        'Partner information.',
                                                },
                                                _id: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
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
                                            nullable: true,
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
    },
    '/manage/add-partner': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add partner',
                operationId: 'postManageAddPartner',
                description:
                    'Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/PartnerInput',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Partner',
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
    },
    '/manage/edit-partner/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit partner',
                operationId: 'patchManageEditPartnerId',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    description: {
                                        type: 'string',
                                        example: 'Partner information.',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Partner',
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
    },
    '/manage/delete-partner/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete partner',
                operationId: 'deleteManageDeletePartnerId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Partner',
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
    },
    '/manage/get-contact-us': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get contact-us',
                operationId: 'getManageGetContactUs',
                description:
                    'Public content. Returns the first document, or null if absent.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                email: {
                                                    type: 'string',
                                                    example:
                                                        'support@example.com',
                                                },
                                                phone_number: {
                                                    type: 'string',
                                                    example: '+8801700000000',
                                                },
                                                _id: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
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
                                            nullable: true,
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
    },
    '/manage/add-contact-us': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add contact-us',
                operationId: 'postManageAddContactUs',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ContactDetailsInput',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/ContactDetails',
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
    },
    '/manage/edit-contact-us/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit contact-us',
                operationId: 'patchManageEditContactUsId',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    email: {
                                        type: 'string',
                                        example: 'support@example.com',
                                    },
                                    phone_number: {
                                        type: 'string',
                                        example: '+8801700000000',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/ContactDetails',
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
    },
    '/manage/delete-contact-us/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete contact-us',
                operationId: 'deleteManageDeleteContactUsId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/ContactDetails',
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
    },
    '/manage/get-faq': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get faq',
                operationId: 'getManageGetFaq',
                description: 'Public content. Returns an array.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/FAQ',
                                            },
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
    },
    '/manage/add-faq': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add faq',
                operationId: 'postManageAddFaq',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/FAQInput' },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/FAQ',
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
    },
    '/manage/edit-faq/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit faq',
                operationId: 'patchManageEditFaqId',
                description: 'Required role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
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
                                    question: {
                                        type: 'string',
                                        example: 'How do I contact support?',
                                    },
                                    answer: {
                                        type: 'string',
                                        example: 'Email support@example.com.',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/FAQ',
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
    },
    '/manage/delete-faq/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete faq',
                operationId: 'deleteManageDeleteFaqId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/FAQ',
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
    },
    '/manage/get-slider': {
        get: {
            ...{
                tags: ['Website content'],
                summary: 'Get slider',
                operationId: 'getManageGetSlider',
                description: 'Public content. Returns an array.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/Slider',
                                            },
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
    },
    '/manage/add-slider': {
        post: {
            ...{
                tags: ['Website content'],
                summary: 'Add slider',
                operationId: 'postManageAddSlider',
                description:
                    'Multipart title and image file; stored image paths are returned by the existing local uploader.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: {
                                        type: 'string',
                                        example: 'Welcome',
                                    },
                                    image: { type: 'string', format: 'binary' },
                                },
                                required: ['title', 'image'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Slider',
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
    },
    '/manage/edit-slider/{id}': {
        patch: {
            ...{
                tags: ['Website content'],
                summary: 'Edit slider',
                operationId: 'patchManageEditSliderId',
                description:
                    'Multipart title and image file; stored image paths are returned by the existing local uploader.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: {
                                        type: 'string',
                                        example: 'Welcome',
                                    },
                                    image: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Slider',
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
    },
    '/manage/delete-slider/{id}': {
        delete: {
            ...{
                tags: ['Website content'],
                summary: 'Delete slider',
                operationId: 'deleteManageDeleteSliderId',
                description:
                    'Permanently deletes the document and returns it.\n\nRequired role: superAdmin, admin, manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['admin', 'manager', 'superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Slider',
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
    },
    '/notification/get-notifications': {
        get: {
            ...{
                tags: ['Notifications'],
                summary: 'List notifications',
                operationId: 'getNotificationGetNotifications',
                description:
                    'Lists notifications for the authenticated profile; superAdmin uses receiver admin.\n\nRequired role: superAdmin, client, worker, admin.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'client', 'worker', 'admin'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across title.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Comma-separated fields, for example name,email.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    allOf: [
                                                        {
                                                            $ref: '#/components/schemas/Pagination',
                                                        },
                                                        {
                                                            type: 'object',
                                                            properties: {
                                                                unreadCount: {
                                                                    type: 'integer',
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Notification',
                                                    },
                                                },
                                            },
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
    },
    '/notification/see-notifications': {
        patch: {
            ...{
                tags: ['Notifications'],
                summary: 'Mark all notifications read',
                operationId: 'patchNotificationSeeNotifications',
                description:
                    "No request body. Marks the receiver's notifications isRead=true.\n\nRequired role: superAdmin, client, worker, admin.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'client', 'worker', 'admin'],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/UpdateResult',
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
    },
    '/notification/delete-notification/{id}': {
        delete: {
            ...{
                tags: ['Notifications'],
                summary: 'Delete a notification',
                operationId: 'deleteNotificationDeleteNotificationId',
                description:
                    'Deletes only a notification belonging to the receiver. Returns null if none matches.\n\nRequired role: superAdmin, client, worker, admin.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'client', 'worker', 'admin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                _id: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
                                                },
                                                receiver: { type: 'string' },
                                                type: { type: 'string' },
                                                title: { type: 'string' },
                                                message: { type: 'string' },
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
                                                            pattern:
                                                                '^[a-fA-F0-9]{24}$',
                                                            example:
                                                                '507f1f77bcf86cd799439011',
                                                        },
                                                        meta: {
                                                            type: 'object',
                                                            properties: {},
                                                        },
                                                    },
                                                },
                                                isRead: { type: 'boolean' },
                                                isSeen: { type: 'boolean' },
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
                                            nullable: true,
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
    },
    '/file/upload-conversation-files': {
        post: {
            ...{
                tags: ['Files'],
                summary: 'Upload conversation attachments',
                operationId: 'postFileUploadConversationFiles',
                description:
                    'Maximum 50 MiB per file. Requires S3 and CloudFront configuration. conversation_video is not accepted by the uploader, so videos is currently an empty array. Supply at least one supported attachment field.\n\nRequired role: worker, client.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker', 'client'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    conversation_image: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                            format: 'binary',
                                        },
                                        maxItems: 5,
                                    },
                                    conversation_pdf: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                            format: 'binary',
                                        },
                                        maxItems: 2,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                images: {
                                                    type: 'array',
                                                    items: { type: 'string' },
                                                },
                                                videos: {
                                                    type: 'array',
                                                    items: { type: 'string' },
                                                },
                                                pdfs: {
                                                    type: 'array',
                                                    items: { type: 'string' },
                                                },
                                            },
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
    },
    '/file/delete-files': {
        post: {
            ...{
                tags: ['Files'],
                summary: 'Delete uploaded files',
                operationId: 'postFileDeleteFiles',
                description:
                    'Deletes each supplied file through the existing S3 delete helper.\n\nRequired role: worker, client.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker', 'client'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    files: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                            example:
                                                'https://cdn.example.com/uploads/images/conversation_image/example.png',
                                        },
                                    },
                                },
                                required: ['files'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/legal-info/get': {
        get: {
            ...{
                tags: ['Legal information'],
                summary: 'Get legal information',
                operationId: 'getLegalInfoGet',
                description:
                    'Public endpoint. Returns the first record or null; no venue-owner parameter is used.',
                security: [],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                venueOwner: {
                                                    type: 'string',
                                                    pattern:
                                                        '^[a-fA-F0-9]{24}$',
                                                    example:
                                                        '507f1f77bcf86cd799439011',
                                                },
                                                companyName: { type: 'string' },
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
                                            nullable: true,
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
    },
    '/legal-info/add-update': {
        post: {
            ...{
                tags: ['Legal information'],
                summary: 'Create or update legal information',
                operationId: 'postLegalInfoAddUpdate',
                description:
                    'Upserts the first record using an empty filter, not a venue-owner-specific lookup. Supply all company/contact fields and venueOwner when creating.\n\nRequired role: superAdmin.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LegalInfo' },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/LegalInfo',
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
    },
    '/admin/create-admin': {
        post: {
            ...{
                tags: ['Administration'],
                summary: 'Create an administrator',
                operationId: 'postAdminCreateAdmin',
                description:
                    'superAdmin only. Creates user/profile in a transaction and sends credentials by email. For multipart, put JSON in data and the image in profile_image.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AdminCreate',
                            },
                        },
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    data: {
                                        type: 'string',
                                        description:
                                            'JSON-encoded profile object.',
                                        example:
                                            '{"name":"Example Admin","email":"admin@example.com","password":"ExamplePass123!","confirmPassword":"ExamplePass123!"}',
                                    },
                                    profile_image: {
                                        type: 'string',
                                        format: 'binary',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Admin',
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
    },
    '/admin/update-admin': {
        patch: {
            ...{
                tags: ['Administration'],
                summary: "Update the caller's admin profile",
                operationId: 'patchAdminUpdateAdmin',
                description:
                    "superAdmin only, but the service searches Admin by the caller's user ID. Can return null when that caller has no Admin profile. No target ID is accepted.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    email: { type: 'string', format: 'email' },
                                    address: { type: 'string' },
                                    website: { type: 'string' },
                                },
                            },
                        },
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    data: {
                                        type: 'string',
                                        description:
                                            'JSON-encoded profile object.',
                                        example:
                                            '{"name":"Example Admin","email":"admin@example.com","password":"ExamplePass123!","confirmPassword":"ExamplePass123!"}',
                                    },
                                    profile_image: {
                                        type: 'string',
                                        format: 'binary',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                _id: {
                                                    $ref: '#/components/schemas/ObjectId',
                                                },
                                                user: {
                                                    $ref: '#/components/schemas/ObjectId',
                                                },
                                                name: { type: 'string' },
                                                email: {
                                                    type: 'string',
                                                    format: 'email',
                                                },
                                                phone: { type: 'string' },
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
                                                isActive: { type: 'boolean' },
                                            },
                                            nullable: true,
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
    },
    '/admin/delete-admin/{id}': {
        delete: {
            ...{
                tags: ['Administration'],
                summary: 'Delete an administrator',
                operationId: 'deleteAdminDeleteAdminId',
                description:
                    'superAdmin only. Permanently deletes both administrator profile and user in a transaction.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Null',
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
    },
    '/admin/update-admin-status/{id}': {
        patch: {
            ...{
                tags: ['Administration'],
                summary: 'Toggle administrator status',
                operationId: 'patchAdminUpdateAdminStatusId',
                description:
                    'superAdmin only. No body. Toggles isActive on both profile and user.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin'],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'MongoDB document identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Admin',
                                        },
                                    },
                                    required: ['success', 'message'],
                                },
                            },
                        },
                    },
                    '503': {
                        description: 'Status update transaction failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
        },
    },
    '/admin/all-admins': {
        get: {
            ...{
                tags: ['Administration'],
                summary: 'List administrators',
                operationId: 'getAdminAllAdmins',
                description:
                    'superAdmin only. Pagination is in data.meta. The current searchTerm implementation targets storeName, which is absent from the admin model.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Comma-separated fields, for example name,email.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Admin',
                                                    },
                                                },
                                            },
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
    },
    '/meta/meta-data': {
        get: {
            ...{
                tags: ['Dashboard'],
                summary: 'Get dashboard totals',
                operationId: 'getMetaMetaData',
                description:
                    'superAdmin or admin. Counts all Client and Worker documents; pendingReports is a placeholder fixed at zero. admin authentication profile lookup is unfinished.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'admin'],
                parameters: [],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                totalCustomer: {
                                                    type: 'integer',
                                                },
                                                totalProvider: {
                                                    type: 'integer',
                                                },
                                                pendingReports: {
                                                    type: 'integer',
                                                    enum: [0],
                                                },
                                            },
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
    },
    '/meta/customer-chart-data': {
        get: {
            ...{
                tags: ['Dashboard'],
                summary: 'Get monthly customer counts',
                operationId: 'getMetaCustomerChartData',
                description:
                    'superAdmin or admin. Returns twelve monthly buckets. Known mismatch: aggregation reads createdAt but Client stores created_at; counts can be zero.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'admin'],
                parameters: [
                    {
                        name: 'year',
                        in: 'query',
                        required: true,
                        schema: { type: 'integer', example: 2026 },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                chartData: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            month: {
                                                                type: 'string',
                                                            },
                                                            totalUser: {
                                                                type: 'integer',
                                                            },
                                                        },
                                                    },
                                                },
                                                yearsDropdown: {
                                                    type: 'array',
                                                    items: { type: 'integer' },
                                                },
                                            },
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
    },
    '/meta/provider-chart-data': {
        get: {
            ...{
                tags: ['Dashboard'],
                summary: 'Get monthly provider counts',
                operationId: 'getMetaProviderChartData',
                description:
                    'superAdmin or admin. Returns twelve monthly buckets. Counts Worker creation dates.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'admin'],
                parameters: [
                    {
                        name: 'year',
                        in: 'query',
                        required: true,
                        schema: { type: 'integer', example: 2026 },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                chartData: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            month: {
                                                                type: 'string',
                                                            },
                                                            totalUser: {
                                                                type: 'integer',
                                                            },
                                                        },
                                                    },
                                                },
                                                yearsDropdown: {
                                                    type: 'array',
                                                    items: { type: 'integer' },
                                                },
                                            },
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
    },
    '/meta/get-activities': {
        get: {
            ...{
                tags: ['Dashboard'],
                summary: 'Compare activity counts',
                operationId: 'getMetaGetActivities',
                description:
                    'superAdmin or admin. report is a zero-valued placeholder. Date-filtered Client counts use createdAt despite the model storing created_at. Errors caught by this service can omit data.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['superAdmin', 'admin'],
                parameters: [
                    {
                        name: 'frame',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Optional reporting frame, e.g. Last 24 Hours or Last Week. Omit for all time.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                customers: {
                                                    type: 'object',
                                                    properties: {
                                                        count: {
                                                            type: 'integer',
                                                        },
                                                        changePercent: {
                                                            type: 'number',
                                                        },
                                                    },
                                                },
                                                providers: {
                                                    type: 'object',
                                                    properties: {
                                                        count: {
                                                            type: 'integer',
                                                        },
                                                        changePercent: {
                                                            type: 'number',
                                                        },
                                                    },
                                                },
                                                report: {
                                                    type: 'object',
                                                    properties: {
                                                        count: {
                                                            type: 'integer',
                                                            enum: [0],
                                                        },
                                                        changePercent: {
                                                            type: 'integer',
                                                            enum: [0],
                                                        },
                                                    },
                                                },
                                            },
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
    },
    '/shift/my-shifts': {
        get: {
            tags: ['Shifts'],
            summary: 'List my shifts for a specific date',
            operationId: 'getShiftMyShifts',
            description: 'Returns the authenticated worker\'s saved and virtual shifts across cleaning plans, ordered by start time. Saved assignments override plan defaults, including worker removals. Includes completed and cancelled saved shifts. Virtual occurrences use active, non-completed plans and current task recurrence; past virtual entries are not historical snapshots. cleaning_plan is an object containing _id and title; title is null if the plan is missing. This read never creates shifts. Required role: worker.',
            security: [{ bearerAuth: [] }],
            'x-roles': ['worker'],
            parameters: [{
                name: 'date',
                in: 'query',
                required: true,
                description: 'Valid UTC calendar date in YYYY-MM-DD format.',
                schema: { type: 'string', format: 'date', example: '2026-09-13' },
            }],
            responses: {
                ...errors,
                '200': {
                    description: 'Worker shifts, or an empty array when none are assigned.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: 'Shifts retrieved successfully' },
                                    data: { type: 'array', items: { $ref: '#/components/schemas/MyShift' } },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/my-active-shift': {
        get: {
            tags: ['Shifts'],
            summary: 'My active shift',
            operationId: 'getShiftMyActiveShift',
            description:
                "Worker-only. The worker's current shift: status in_progress AND this worker is personally still checked in (their own check_in_at set, check_out_at null) — not just assigned to some in-progress shift, since other workers on it may still be working after this one left. Returns {} (empty object) when there isn't one.\n\nRequired role: worker.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['worker'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: 'The active shift, or {} when none.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: 'Active shift retrieved successfully' },
                                    data: {
                                        oneOf: [
                                            { $ref: '#/components/schemas/ShiftWithProgress' },
                                            { type: 'object', properties: {}, additionalProperties: false, description: 'Empty object when no active shift.' },
                                        ],
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/my-today-meta': {
        get: {
            tags: ['Shifts'],
            summary: "My today's shift counts",
            operationId: 'getShiftMyTodayMeta',
            description:
                "Worker-only. Counters for today's shifts (saved + virtual occurrences, same universe as /shift/my-shifts): total_shift, completed, and pending (total_shift - completed; covers upcoming/in_progress/cancelled alike).\n\nRequired role: worker.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['worker'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: "Today's shift counters.",
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: "Today's shift metadata retrieved successfully" },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            total_shift: { type: 'integer' },
                                            completed: { type: 'integer' },
                                            pending: { type: 'integer' },
                                        },
                                        required: ['total_shift', 'completed', 'pending'],
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/my-next-shift': {
        get: {
            tags: ['Shifts'],
            summary: 'My next shift',
            operationId: 'getShiftMyNextShift',
            description:
                "Worker-only. The next upcoming shift strictly after now, whichever is sooner of: the nearest already-materialized Shift assigned to this worker, or the nearest not-yet-materialized occurrence projected from the recurrence patterns of this worker's currently assigned plans (up to a 90-day horizon). is_virtual: true marks a projected occurrence that has no Shift document yet (no check-in/photo actions are possible on it until it materializes, which happens automatically once its own day arrives). Returns {} (empty object) when there is none within the horizon.\n\nRequired role: worker.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['worker'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: 'The next shift, or {} when none.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: 'Next shift retrieved successfully' },
                                    data: {
                                        oneOf: [
                                            { $ref: '#/components/schemas/ShiftSummary' },
                                            { type: 'object', properties: {}, additionalProperties: false, description: 'Empty object when no next shift.' },
                                        ],
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/worker-performance/{workerId}': {
        get: {
            tags: ['Shifts'],
            summary: 'Worker performance for a month',
            operationId: 'getShiftWorkerPerformanceWorkerId',
            description:
                "Manager-only. Monthly performance counters for one worker, combining materialized Shift documents (the only source for completed/in_progress/late/absent/worked-hours, since those need real check-in/check-out data) with not-yet-materialized future occurrences projected from the worker's currently active plans (so a mostly-future month doesn't look artificially empty). late has no grace period (any check_in_at after the scheduled date_time counts). absent only ever counts materialized shifts whose date has passed with no check-in — an occurrence that was never materialized leaves no record to judge. Defaults to the current UTC month/year when month/year aren't given.\n\nRequired role: manager.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager'],
            parameters: [
                {
                    name: 'workerId',
                    in: 'path',
                    required: true,
                    description: 'MongoDB document identifier.',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                },
                {
                    name: 'month',
                    in: 'query',
                    schema: { type: 'integer', minimum: 1, maximum: 12 },
                    description: 'Defaults to the current UTC month.',
                },
                {
                    name: 'year',
                    in: 'query',
                    schema: { type: 'integer' },
                    description: 'Defaults to the current UTC year.',
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: 'Worker performance for the given (or current) month.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: 'Worker performance retrieved successfully' },
                                    data: { $ref: '#/components/schemas/WorkerPerformance' },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/today-live-shift-meta': {
        get: {
            tags: ['Shifts'],
            summary: "Today's live shift metadata (system-wide)",
            operationId: 'getShiftTodayLiveShiftMeta',
            description:
                "Manager-only, but NOT scoped to the calling manager — every manager sees the same system-wide numbers. Counters for today's shifts across all cleaning plans: total_shift, completed_shift, in_progress, pending (status 'upcoming'). Only counts already-materialized Shift documents — the nightly cron plus this system's same-day auto-materialization on plan create/update/assign means today's occurrences are expected to already exist by the time anyone looks at this.\n\nRequired role: manager.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: "Today's system-wide shift counters.",
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: "Today's live shift metadata retrieved successfully" },
                                    data: { $ref: '#/components/schemas/TodayLiveShiftMeta' },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/today-live-shifts': {
        get: {
            tags: ['Shifts'],
            summary: "Today's live shifts (list, system-wide)",
            operationId: 'getShiftTodayLiveShifts',
            description:
                "Manager-only, not scoped to the calling manager — every manager sees the same system-wide list. Every shift materialized for today, filterable by location, client and status, with resolved cleaning_plan/client context and progress totals — a lean list view (no rooms[]/tasks[]/assigned_workers[] detail; use GET /shift/single-live-shift/{id} for that). Backed by a { date, 'location.location' } index. Pagination is nested under data.meta; records are under data.result.\n\nRequired role: manager.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager'],
            parameters: [
                {
                    name: 'location',
                    in: 'query',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                    description: "Filter to shifts whose location matches this location's id. Returns 400 if not a valid ObjectId.",
                },
                {
                    name: 'client',
                    in: 'query',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                    description: "Filter to shifts belonging to this client's cleaning plans. Returns 400 if not a valid ObjectId.",
                },
                {
                    name: 'status',
                    in: 'query',
                    schema: {
                        type: 'string',
                        enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
                    },
                    description: 'Filter to shifts with this status. Returns 400 for any other value.',
                },
                {
                    name: 'page',
                    in: 'query',
                    schema: { type: 'integer', default: 1, minimum: 1 },
                    description: 'Use a positive page number.',
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
                    description: 'Use a positive page size. Clamped server-side to 100 max.',
                },
                {
                    name: 'sort',
                    in: 'query',
                    schema: {
                        type: 'string',
                        default: 'date_time',
                        enum: ['date_time', '-date_time', 'status', '-status', 'createdAt', '-createdAt', 'updatedAt', '-updatedAt'],
                    },
                    description: 'Single field; prefix with - for descending order. Any other field returns 400.',
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: "Today's shifts, or an empty array when there are none.",
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: "Today's live shifts retrieved successfully" },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            meta: { $ref: '#/components/schemas/Pagination' },
                                            result: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/ShiftListItem' },
                                            },
                                        },
                                        required: ['meta', 'result'],
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/single-live-shift/{id}': {
        get: {
            tags: ['Shifts'],
            summary: 'Get one shift (full detail)',
            operationId: 'getShiftSingleLiveShiftId',
            description:
                "Manager-only. Full detail for one Shift by its own _id (not planId/date) — tasks[], rooms[] (with per-room progress), assigned_workers[], plus resolved cleaning_plan/client context and overall progress totals. Not restricted to today; any materialized shift can be fetched this way. Returns 400 for a malformed id, 404 if no shift has that id.\n\nRequired role: manager.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['manager'],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    description: 'MongoDB document identifier (the Shift\'s own _id).',
                    schema: { $ref: '#/components/schemas/ObjectId' },
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: 'The shift.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: 'Shift retrieved successfully' },
                                    data: { $ref: '#/components/schemas/ShiftDetail' },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/my-live-status': {
        get: {
            tags: ['Shifts'],
            summary: 'My live shift status',
            operationId: 'getShiftMyLiveStatus',
            description:
                "Client-only. Every in_progress shift across all of this client's active cleaning plans, each with room-level and overall completion progress computed live (never cached/stored). Overall progress is the average of each room's progress, not a raw task count across the whole shift. tasks[] is intentionally omitted from the response — use the manager/worker shift-detail endpoints for full per-task detail.\n\nRequired role: client.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['client'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: 'In-progress shifts, or an empty array when none are active right now.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string', example: 'Live shift status retrieved successfully' },
                                    data: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/ShiftLiveStatus' },
                                    },
                                },
                                required: ['success', 'message', 'data'],
                            },
                        },
                    },
                },
            },
        },
    },
    '/shift/{planId}': {
        get: {
            ...{
                tags: ['Shifts'],
                summary: 'List a cleaning plan\'s shift occurrences in a date range',
                operationId: 'getShiftPlanId',
                description:
                    'Returns one entry per date the plan actually occurs on within [from, to] (dates it does not occur on are omitted, not returned empty). Each entry is either an already-materialized Shift or a virtual, unsaved preview (is_virtual: true) computed live from the plan\'s current rooms/tasks/assigned_workers. See docs/SHIFT_MANAGEMENT_DESIGN.md.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'from',
                        in: 'query',
                        schema: { type: 'string', format: 'date' },
                        description: 'Defaults to today.',
                    },
                    {
                        name: 'to',
                        in: 'query',
                        schema: { type: 'string', format: 'date' },
                        description: 'Defaults to from + 30 days.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/Shift',
                                            },
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
    },
    '/shift/{planId}/{date}': {
        get: {
            ...{
                tags: ['Shifts'],
                summary: 'Get one shift occurrence',
                operationId: 'getShiftPlanIdDate',
                description:
                    'date is an ISO date (YYYY-MM-DD). Returns the materialized Shift if one exists, otherwise a virtual preview (is_virtual: true) computed from the plan\'s current state. 404 if the plan has no occurrence on that date. A worker caller is only allowed to view a shift they are actually in assigned_workers for — 403 otherwise; a manager may view any shift.\n\nRequired role: manager or worker.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager', 'worker'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'date',
                        in: 'path',
                        required: true,
                        description: 'ISO date (YYYY-MM-DD).',
                        schema: { type: 'string', format: 'date' },
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Shift',
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
    },
    '/shift/{planId}/{date}/assign-workers': {
        patch: {
            ...{
                tags: ['Shifts'],
                summary: 'Assign workers to one specific shift occurrence',
                operationId: 'patchShiftPlanIdDateAssignWorkers',
                description:
                    'Materializes the shift for this date first if it does not exist yet, then replaces its assigned_workers, diverging it from the plan\'s default assignment (is_worker_overridden becomes true). Ineligible workers (deleted/blocked/inactive) are always rejected with 400. A scheduling conflict — against either another materialized shift or another plan\'s not-yet-materialized occurrence — is rejected with 409 unless force=true, in which case the conflicted entries are saved with assigned_with_conflict=true for audit purposes. See docs/SHIFT_MANAGEMENT_DESIGN.md.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'date',
                        in: 'path',
                        required: true,
                        description: 'ISO date (YYYY-MM-DD).',
                        schema: { type: 'string', format: 'date' },
                    },
                    {
                        name: 'force',
                        in: 'query',
                        schema: { type: 'boolean' },
                        description:
                            'Alternative to force in the body; assign despite scheduling conflicts.',
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    assigned_workers: {
                                        type: 'array',
                                        minItems: 1,
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
                                    force: { type: 'boolean' },
                                },
                                required: ['assigned_workers'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Shift',
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
    },
    '/shift/{planId}/{date}/status': {
        patch: {
            ...{
                tags: ['Shifts'],
                summary: 'Update one shift occurrence\'s status',
                operationId: 'patchShiftPlanIdDateStatus',
                description:
                    'Materializes the shift for this date first if it does not exist yet, then updates its status.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'date',
                        in: 'path',
                        required: true,
                        description: 'ISO date (YYYY-MM-DD).',
                        schema: { type: 'string', format: 'date' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: {
                                        type: 'string',
                                        enum: [
                                            'upcoming',
                                            'in_progress',
                                            'completed',
                                            'cancelled',
                                        ],
                                    },
                                },
                                required: ['status'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Shift',
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
    },
    '/shift/{planId}/{date}/tasks/{taskId}/photo': {
        patch: {
            ...{
                tags: ['Shifts'],
                summary: 'Upload a required photo for one shift task',
                operationId: 'patchShiftPlanIdDateTasksTaskIdPhoto',
                description:
                    'Materializes the shift for this date first if it does not exist yet. title must match one of that task instance\'s photo_requirements titles (frozen at materialization time) or this returns 400. Only a worker assigned to this shift may upload. is_completed on the task entry is recomputed automatically once every required photo is uploaded — there is no manual complete/approve step. Once every task on the shift has is_completed: true, the shift\'s own top-level status auto-advances to \'completed\'. See docs/SHIFT_MANAGEMENT_DESIGN.md.\n\nRequired role: worker.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'date',
                        in: 'path',
                        required: true,
                        description: 'ISO date (YYYY-MM-DD).',
                        schema: { type: 'string', format: 'date' },
                    },
                    {
                        name: 'taskId',
                        in: 'path',
                        required: true,
                        description:
                            "The source Task's identifier (matches tasks[].task on the shift).",
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
                                    title: {
                                        type: 'string',
                                        description:
                                            'Must match one of this task instance\'s photo_requirements titles.',
                                    },
                                    photo_url: {
                                        type: 'string',
                                        description:
                                            'URL of the already-uploaded file (upload the file via the file module first, then submit its URL here).',
                                    },
                                },
                                required: ['title', 'photo_url'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Shift',
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
    },
    '/shift/{planId}/{date}/check-in': {
        patch: {
            ...{
                tags: ['Shifts'],
                summary: 'Check in to a shift',
                operationId: 'patchShiftPlanIdDateCheckIn',
                description:
                    'Does NOT materialize a virtual shift — only an already-materialized shift (created by the daily cron or an earlier edit) can be checked into; 404 otherwise. No time-window restriction: valid any time on the shift\'s date. The submitted coordinates must be within 50 meters of the shift\'s frozen location snapshot (Haversine distance) or this returns 400; a location with no configured GPS point always fails closed. Only a worker assigned to this shift may check in, and only once. See docs/SHIFT_MANAGEMENT_DESIGN.md.\n\nRequired role: worker.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'date',
                        in: 'path',
                        required: true,
                        description: 'ISO date (YYYY-MM-DD).',
                        schema: { type: 'string', format: 'date' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    latitude: { type: 'number', minimum: -90, maximum: 90 },
                                    longitude: { type: 'number', minimum: -180, maximum: 180 },
                                },
                                required: ['latitude', 'longitude'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Shift',
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
    },
    '/shift/{planId}/{date}/check-out': {
        patch: {
            ...{
                tags: ['Shifts'],
                summary: 'Check out from a shift',
                operationId: 'patchShiftPlanIdDateCheckOut',
                description:
                    "Same rules as check-in (no materialization, 50m geofence, worker must be assigned) plus: the worker must already have checked in and must not already have checked out, AND the shift's own top-level status must already be 'completed' (every task's required photos uploaded) — 400 otherwise. Workers stay checked in for the duration of the actual cleaning work; check-out only becomes available once the shift as a whole is finished. See docs/SHIFT_MANAGEMENT_DESIGN.md.\n\nRequired role: worker.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker'],
                parameters: [
                    {
                        name: 'planId',
                        in: 'path',
                        required: true,
                        description: 'Cleaning plan identifier.',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                    },
                    {
                        name: 'date',
                        in: 'path',
                        required: true,
                        description: 'ISO date (YYYY-MM-DD).',
                        schema: { type: 'string', format: 'date' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    latitude: { type: 'number', minimum: -90, maximum: 90 },
                                    longitude: { type: 'number', minimum: -180, maximum: 180 },
                                },
                                required: ['latitude', 'longitude'],
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Shift',
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
    },
    '/invoice/create-invoice': {
        post: {
            ...{
                tags: ['Invoices'],
                summary: 'Create invoice',
                operationId: 'postInvoiceCreateInvoice',
                description:
                    "Manager-only. Records a payment made to a worker. The worker must exist and not be deleted, and its pending_amount (total_earning - total_paid) must be >= amount, or this returns 400. On success, amount is added to the worker's total_paid and subtracted from pending_amount.\n\nRequired role: manager.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/InvoiceCreate',
                            },
                        },
                    },
                },
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            $ref: '#/components/schemas/Invoice',
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
    },
    '/invoice/all-invoices': {
        get: {
            ...{
                tags: ['Invoices'],
                summary: 'List all invoices',
                operationId: 'getInvoiceAllInvoices',
                description:
                    'Manager-only. Pagination is nested under data.meta; records are under data.result.\n\nRequired role: manager.',
                security: [{ bearerAuth: [] }],
                'x-roles': ['manager'],
                parameters: [
                    {
                        name: 'worker',
                        in: 'query',
                        schema: { $ref: '#/components/schemas/ObjectId' },
                        description: 'Filter invoices for this worker.',
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across payment_method, transaction_id, notes.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Comma-separated fields, for example amount,payment_method.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Invoice',
                                                    },
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
    },
    '/invoice/my-invoices': {
        get: {
            ...{
                tags: ['Invoices'],
                summary: 'My invoices',
                operationId: 'getInvoiceMyInvoices',
                description:
                    "Worker-only. Returns invoices belonging to the authenticated worker; a `worker` query param is ignored (the caller's own scope is always enforced). Pagination is nested under data.meta; records are under data.result.\n\nRequired role: worker.",
                security: [{ bearerAuth: [] }],
                'x-roles': ['worker'],
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
                        schema: { type: 'integer', default: 10 },
                        description: 'Use a positive page size.',
                    },
                    {
                        name: 'searchTerm',
                        in: 'query',
                        schema: { type: 'string' },
                        description:
                            'Case-insensitive regex search across payment_method, transaction_id, notes.',
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', default: '-createdAt' },
                        description:
                            'Single field; prefix with - for descending order.',
                    },
                ],
            },
            responses: {
                ...errors,
                ...{
                    '200': {
                        description:
                            'Successful request. HTTP 200 is also used for create and delete operations.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean',
                                            enum: [true],
                                        },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                meta: {
                                                    $ref: '#/components/schemas/Pagination',
                                                },
                                                result: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/Invoice',
                                                    },
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
    },
};
export default paths;
