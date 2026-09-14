import paths from './paths';
import schemas from './schemas';

export function createOpenApiDocument(serverUrl = '/api/v1') {
    return {
        openapi: '3.0.3',
        info: {
            title: 'cleanones-backend API',
            version: '1.0.0',
            description: [
                'API reference for the implemented HTTP routes in the current, unfinished cleanones-backend.',
                '**Getting started:** log in, copy data.accessToken, then use Authorize with the token only. Create client → location → room → task.',
                '**Authentication:** Bearer JWT for protected routes. Refresh uses the HttpOnly refreshToken cookie. Required roles are listed per operation.',
                '**Responses:** HTTP 200 for successful creates, updates and deletes. Lists use data.meta and data.result. IDs are MongoDB ObjectIds; dates are ISO 8601.',
                '**Limits:** global API limit 60 requests/minute per IP; sensitive authentication routes share 3 requests/minute per email or IP. A 429 response includes Retry-After.',
                '**Current limitations:** manager/admin profile lookup in auth.ts is unfinished. Zod validation failures currently return HTTP 500. These docs describe contracts and do not certify backend readiness.',
                '**Coverage:** authentication, users, clients, locations, rooms, tasks, administration, website content, notifications, files, legal information and implemented dashboard operations. User registration has a validation/service payload mismatch; account upgrade is not implemented. These limitations are documented on their endpoints. The super-admin module and placeholder earnings chart remain excluded. Conversation, message and support routers are not mounted; testimonials are empty.',
                '**Standalone preview:** this server hosts documentation only. API requests require a running backend; configure DOCS_API_URL with its full URL ending in /api/v1.',
            ].join('\n\n'),
        },
        servers: [
            {
                url: serverUrl,
                description:
                    serverUrl === '/api/v1'
                        ? 'Current backend'
                        : 'Configured backend',
            },
        ],
        tags: [
            ['Question suggestions', 'Public questions and answers managed by managers.'],
            ['Issue reports', 'Worker-reported issues managed by managers.'],
            ['Authentication', 'Login, tokens and password recovery.'],
            ['Users', 'Registration, verification, profiles and account management.'],
            ['Clients', 'Manager-managed customer accounts.'],
            ['Client contacts', 'Manager-only contact creation, updates, deletion and retrieval.'],
            ['Locations', 'Client sites and room counts.'],
            ['Rooms', 'Rooms within a location and task counts.'],
            ['Tasks', 'Daily, weekly and monthly task definitions.'],
            ['Workers', 'Manager-managed worker profiles and availability.'],
            [
                'Cleaning plans',
                'Manager-scheduled cleaning plans with assigned workers.',
            ],
            [
                'Additional tasks',
                'Extra tasks created by clients or managers. Manager-created tasks are automatically approved.',
            ],
            ['Administration', 'Administrator account management.'],
            [
                'Website content',
                'Public content reads and superAdmin content management.',
            ],
            ['Notifications', 'Notifications for the authenticated receiver.'],
            ['Files', 'S3 conversation attachments.'],
            ['Legal information', 'Shared company and platform information.'],
            [
                'Dashboard',
                'Counts and reporting; limitations are noted per operation.',
            ],
        ].map(([name, description]) => ({ name, description })),
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description:
                        'Paste the access token without the Bearer prefix.',
                },
                refreshCookie: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'refreshToken',
                    description:
                        'Set by login. Browsers manage this HttpOnly cookie; Swagger cannot set it manually.',
                },
            },
            schemas,
        },
        paths,
    };
}
