const errors = {
    '400': {
        description: 'Invalid range value or model validation failure.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
            },
        },
    },
    '401': {
        description: 'Missing, invalid, expired token, or role not allowed.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
            },
        },
    },
    '403': {
        description: 'Account is blocked or inactive.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
            },
        },
    },
    '404': {
        description: 'Authenticated client profile not found.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
            },
        },
    },
    '429': {
        description: 'Rate limit exceeded. Respect Retry-After.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
            },
        },
    },
    '500': {
        description: 'Server error.',
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
            },
        },
    },
};

const shiftWorkerProgress = {
    type: 'object',
    properties: {
        worker_id: { type: 'string' },
        name: { type: 'string' },
        role: {
            type: 'string',
            enum: ['Team leader', 'Co-leader', 'Normal worker'],
        },
        is_checked_in: {
            type: 'boolean',
            description: 'true when checked in but not yet checked out.',
        },
        check_in_at: { type: 'string', format: 'date-time', nullable: true },
        check_out_at: { type: 'string', format: 'date-time', nullable: true },
        worked_hours: {
            type: 'number',
            description:
                "Derived from check_in_at/check_out_at. 0 when the worker hasn't checked in. While still checked in on an in_progress shift, computed against the current time.",
        },
    },
};

const activeProgressShift = {
    type: 'object',
    properties: {
        shift_id: { type: 'string' },
        location_name: { type: 'string' },
        status: {
            type: 'string',
            enum: ['upcoming', 'in_progress', 'completed', 'cancelled'],
        },
        start_time: { type: 'string', format: 'date-time' },
        estimated_hours: { type: 'number' },
        rooms: {
            type: 'object',
            properties: {
                total: { type: 'integer' },
                completed: {
                    type: 'integer',
                    description:
                        'A room counts as completed once every plan_task scoped to it is is_completed.',
                },
            },
        },
        tasks: {
            type: 'object',
            properties: {
                total: { type: 'integer' },
                completed: { type: 'integer' },
            },
        },
        workers: {
            type: 'array',
            items: shiftWorkerProgress,
        },
    },
};

const clientOverviewPaths = {
    '/client/active-progress': {
        get: {
            tags: ['Clients'],
            summary: "Today's live shift progress",
            operationId: 'getClientActiveProgress',
            description:
                "Client-only. Live view of the authenticated client's shifts scheduled for today only: room/task completion counts and real worked hours derived from each assigned worker's check_in_at/check_out_at timestamps (0 hours until a worker checks in). Intended for frequent polling (e.g. every 30-60s) while a status of 'active' is returned.\n\nRequired role: client.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['client'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: "Today's active progress retrieved successfully.",
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            date: {
                                                type: 'string',
                                                format: 'date',
                                                description: "Today's date, e.g. 2026-09-15.",
                                            },
                                            status: {
                                                type: 'string',
                                                enum: [
                                                    'no_service',
                                                    'scheduled',
                                                    'active',
                                                    'completed',
                                                ],
                                                description:
                                                    "no_service: nothing scheduled today. scheduled: shifts exist but none are in_progress yet. active: at least one shift is in_progress. completed: every shift today is completed or cancelled.",
                                            },
                                            summary: {
                                                type: 'object',
                                                properties: {
                                                    total_estimated_hours: {
                                                        type: 'number',
                                                        description:
                                                            "Sum of today's shifts' planned duration_minutes, in hours.",
                                                    },
                                                    total_worked_hours: {
                                                        type: 'number',
                                                        description:
                                                            'Sum of actual worked hours across all assigned workers, derived from check-in/check-out.',
                                                    },
                                                    total_rooms: { type: 'integer' },
                                                    completed_rooms: { type: 'integer' },
                                                    total_tasks: { type: 'integer' },
                                                    completed_tasks: { type: 'integer' },
                                                    progress_percentage: {
                                                        type: 'integer',
                                                        description:
                                                            'Rounded completed_tasks / total_tasks * 100. 0 when total_tasks is 0.',
                                                    },
                                                },
                                            },
                                            shifts: {
                                                type: 'array',
                                                items: activeProgressShift,
                                            },
                                        },
                                        required: ['date', 'status', 'summary', 'shifts'],
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
    '/client/shift-stats': {
        get: {
            tags: ['Clients'],
            summary: 'Shift counts by status, filterable by date range',
            operationId: 'getClientShiftStats',
            description:
                "Client-only. Counts of the authenticated client's shifts grouped by status over a fixed window. this_week runs Sunday through Saturday (local server time); this_month is the calendar month. Distinct from /client/active-progress, which only covers today and includes live per-worker detail.\n\nRequired role: client.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['client'],
            parameters: [
                {
                    name: 'range',
                    in: 'query',
                    schema: {
                        type: 'string',
                        enum: ['today', 'this_week', 'this_month'],
                        default: 'today',
                    },
                    description: 'Time window to aggregate shift counts over.',
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: 'Shift stats retrieved successfully.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            range: {
                                                type: 'string',
                                                enum: ['today', 'this_week', 'this_month'],
                                            },
                                            date_from: { type: 'string', format: 'date-time' },
                                            date_to: { type: 'string', format: 'date-time' },
                                            total_shifts: { type: 'integer' },
                                            total_completed_shifts: { type: 'integer' },
                                            total_pending_shifts: {
                                                type: 'integer',
                                                description: 'upcoming + in_progress shifts.',
                                            },
                                            total_cancelled_shifts: { type: 'integer' },
                                            completion_rate: {
                                                type: 'integer',
                                                description:
                                                    'Rounded percentage: total_completed_shifts / (total_shifts - total_cancelled_shifts) * 100. 0 when there is nothing eligible.',
                                            },
                                        },
                                        required: [
                                            'range',
                                            'date_from',
                                            'date_to',
                                            'total_shifts',
                                            'total_completed_shifts',
                                            'total_pending_shifts',
                                            'total_cancelled_shifts',
                                            'completion_rate',
                                        ],
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
    '/client/totals': {
        get: {
            tags: ['Clients'],
            summary: 'Static inventory totals (plans, locations, rooms, tasks)',
            operationId: 'getClientTotals',
            description:
                "Client-only. All-time counts of the authenticated client's cleaning plans, locations, rooms and tasks. Not date-filtered and changes rarely, so it's safe to cache on the frontend.\n\nRequired role: client.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['client'],
            parameters: [],
            responses: {
                ...errors,
                '200': {
                    description: 'Client totals retrieved successfully.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            total_cleaning_plans: { type: 'integer' },
                                            total_locations: { type: 'integer' },
                                            total_rooms: { type: 'integer' },
                                            total_tasks: { type: 'integer' },
                                        },
                                        required: [
                                            'total_cleaning_plans',
                                            'total_locations',
                                            'total_rooms',
                                            'total_tasks',
                                        ],
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
    '/client/roster': {
        get: {
            tags: ['Clients'],
            summary: 'Cleaning-plan-based shift roster',
            operationId: 'getClientPlanRoster',
            description:
                "Client-only. A day/week/month schedule grouped by CLEANING PLAN (not by worker): a page of the authenticated client's cleaning plans, each with every shift falling in the selected window. Merges already-materialized Shift documents with not-yet-materialized virtual occurrences projected from the plan's recurring tasks — the same source of truth used by /client/schedule-roster and the manager-facing /shift/roster (which is the by-worker equivalent of this endpoint). A virtual entry has shift_id: null, status 'upcoming', and 0 completed rooms/tasks since nothing has happened yet.\n\nRequired role: client.",
            security: [{ bearerAuth: [] }],
            'x-roles': ['client'],
            parameters: [
                {
                    name: 'view',
                    in: 'query',
                    schema: {
                        type: 'string',
                        enum: ['day', 'week', 'month'],
                        default: 'day',
                    },
                    description:
                        'Window size. week runs Sunday-Saturday containing date (or today); month is the calendar month for year/month (or the current month).',
                },
                {
                    name: 'date',
                    in: 'query',
                    schema: { type: 'string', format: 'date' },
                    description:
                        "Anchor date for view=day or view=week, e.g. 2026-09-15. Defaults to today. Ignored for view=month.",
                },
                {
                    name: 'year',
                    in: 'query',
                    schema: { type: 'integer' },
                    description: 'Anchor year for view=month. Defaults to the current year.',
                },
                {
                    name: 'month',
                    in: 'query',
                    schema: { type: 'integer', minimum: 1, maximum: 12 },
                    description: 'Anchor month (1-12) for view=month. Defaults to the current month.',
                },
                {
                    name: 'page',
                    in: 'query',
                    schema: { type: 'integer', default: 1 },
                    description: 'Paginates the cleaning-plan list (not the shifts within each plan).',
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 10 },
                    description: 'Cleaning plans per page. 1-50.',
                },
            ],
            responses: {
                ...errors,
                '200': {
                    description: 'Client plan roster retrieved successfully.',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', enum: [true] },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            view: {
                                                type: 'string',
                                                enum: ['day', 'week', 'month'],
                                            },
                                            start_date: {
                                                type: 'string',
                                                format: 'date-time',
                                                description: 'Inclusive UTC start of the window.',
                                            },
                                            end_date: {
                                                type: 'string',
                                                format: 'date-time',
                                                description: 'Exclusive UTC end of the window.',
                                            },
                                            meta: {
                                                type: 'object',
                                                properties: {
                                                    page: { type: 'integer' },
                                                    limit: { type: 'integer' },
                                                    total: {
                                                        type: 'integer',
                                                        description: 'Total cleaning plans matching the client, across all pages.',
                                                    },
                                                    totalPage: { type: 'integer' },
                                                    total_shifts: {
                                                        type: 'integer',
                                                        description: 'Total shift entries across every plan on this page.',
                                                    },
                                                },
                                            },
                                            cleaning_plans: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        plan_id: { type: 'string' },
                                                        plan_title: { type: 'string' },
                                                        location_name: { type: 'string' },
                                                        total_shifts_in_range: { type: 'integer' },
                                                        total_hours_in_range: { type: 'number' },
                                                        shifts: {
                                                            type: 'array',
                                                            items: {
                                                                type: 'object',
                                                                properties: {
                                                                    date: {
                                                                        type: 'string',
                                                                        format: 'date',
                                                                        description: 'e.g. 2026-09-15',
                                                                    },
                                                                    shift_id: {
                                                                        type: 'string',
                                                                        nullable: true,
                                                                        description: 'null when is_virtual is true.',
                                                                    },
                                                                    is_virtual: {
                                                                        type: 'boolean',
                                                                        description: 'true = projected from the plan, not yet materialized in the database.',
                                                                    },
                                                                    status: {
                                                                        type: 'string',
                                                                        enum: [
                                                                            'upcoming',
                                                                            'in_progress',
                                                                            'completed',
                                                                            'cancelled',
                                                                        ],
                                                                    },
                                                                    start_time: {
                                                                        type: 'string',
                                                                        format: 'date-time',
                                                                    },
                                                                    end_time: {
                                                                        type: 'string',
                                                                        format: 'date-time',
                                                                    },
                                                                    duration_minutes: { type: 'integer' },
                                                                    rooms: {
                                                                        type: 'object',
                                                                        properties: {
                                                                            total: { type: 'integer' },
                                                                            completed: { type: 'integer' },
                                                                        },
                                                                    },
                                                                    tasks: {
                                                                        type: 'object',
                                                                        properties: {
                                                                            total: { type: 'integer' },
                                                                            completed: { type: 'integer' },
                                                                        },
                                                                    },
                                                                    assigned_workers: {
                                                                        type: 'array',
                                                                        items: {
                                                                            type: 'object',
                                                                            properties: {
                                                                                worker_id: { type: 'string' },
                                                                                name: { type: 'string' },
                                                                                role: {
                                                                                    type: 'string',
                                                                                    enum: [
                                                                                        'Team leader',
                                                                                        'Co-leader',
                                                                                        'Normal worker',
                                                                                    ],
                                                                                },
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        required: ['view', 'start_date', 'end_date', 'meta', 'cleaning_plans'],
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
};

export default clientOverviewPaths;
