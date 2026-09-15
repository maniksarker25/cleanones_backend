# Client Dashboard API

Base URL: `/api/v1/client`

All endpoints below require:

- **Auth**: `Authorization: Bearer <token>`
- **Role**: `client` (the endpoint resolves the authenticated user's client profile automatically — no client ID needed in the URL)

Standard envelope for every response:

```json
{
  "success": true,
  "message": "string",
  "data": { }
}
```

Error responses:

```json
{
  "success": false,
  "message": "string",
  "errorSources": [{ "path": "string", "message": "string" }]
}
```

| Status | Meaning |
|---|---|
| 400 | Invalid input (e.g. bad `range` value) |
| 401 | Missing/invalid/expired token, or wrong role |
| 403 | Account blocked or inactive |
| 404 | Client profile not found |
| 429 | Rate limited |
| 500 | Server error |

---

## 1. `GET /client/active-progress`

Live view of **today only**: room/task completion and real worked hours derived from each worker's actual check-in/check-out. Poll this every 30–60s while `status` is `"active"`; otherwise poll less frequently.

**Query params**: none

### Response `data`

```ts
{
  date: string;           // "2026-09-15"
  status: "no_service" | "scheduled" | "active" | "completed";
  summary: {
    total_estimated_hours: number;  // planned hours for today's shifts
    total_worked_hours: number;     // real hours from check-in/out (0 until a worker checks in)
    total_rooms: number;
    completed_rooms: number;
    total_tasks: number;
    completed_tasks: number;
    progress_percentage: number;    // 0-100, rounded
  };
  shifts: Array<{
    shift_id: string;
    location_name: string;
    status: "upcoming" | "in_progress" | "completed" | "cancelled";
    start_time: string;             // ISO date-time
    estimated_hours: number;
    rooms: { total: number; completed: number };
    tasks: { total: number; completed: number };
    workers: Array<{
      worker_id: string;
      name: string;
      role: "Team leader" | "Co-leader" | "Normal worker";
      is_checked_in: boolean;       // true = checked in, not yet checked out
      check_in_at: string | null;   // ISO date-time
      check_out_at: string | null;  // ISO date-time
      worked_hours: number;         // 0 if not checked in yet
    }>;
  }>;
}
```

**`status` meaning**:
- `no_service` — nothing scheduled today
- `scheduled` — shifts exist today but none are `in_progress` yet
- `active` — at least one shift is `in_progress`
- `completed` — every shift today is `completed` or `cancelled`

**A room counts as "completed"** once every plan task scoped to that room (not one-off additional tasks) has `is_completed: true`.

### Example

```json
{
  "success": true,
  "message": "Client active progress retrieved successfully",
  "data": {
    "date": "2026-09-15",
    "status": "active",
    "summary": {
      "total_estimated_hours": 6.5,
      "total_worked_hours": 2.25,
      "total_rooms": 8,
      "completed_rooms": 3,
      "total_tasks": 20,
      "completed_tasks": 9,
      "progress_percentage": 45
    },
    "shifts": [
      {
        "shift_id": "66f1a2b3c4d5e6f7a8b9c0d1",
        "location_name": "Downtown Office",
        "status": "in_progress",
        "start_time": "2026-09-15T09:00:00.000Z",
        "estimated_hours": 6.5,
        "rooms": { "total": 8, "completed": 3 },
        "tasks": { "total": 20, "completed": 9 },
        "workers": [
          {
            "worker_id": "66f1a2b3c4d5e6f7a8b9c0d2",
            "name": "Maria Gomez",
            "role": "Team leader",
            "is_checked_in": true,
            "check_in_at": "2026-09-15T09:05:00.000Z",
            "check_out_at": null,
            "worked_hours": 2.25
          }
        ]
      }
    ]
  }
}
```

---

## 2. `GET /client/shift-stats`

Historical shift counts grouped by status, over a selectable window. Not live — safe to poll infrequently (e.g. on page load, or every few minutes).

### Query params

| Param | Type | Required | Default | Values |
|---|---|---|---|---|
| `range` | string | no | `today` | `today` \| `this_week` \| `this_month` |

`this_week` runs Sunday → Saturday (server local time). `this_month` is the calendar month.

### Response `data`

```ts
{
  range: "today" | "this_week" | "this_month";
  date_from: string;              // ISO date-time, inclusive
  date_to: string;                // ISO date-time, inclusive
  total_shifts: number;
  total_completed_shifts: number;
  total_pending_shifts: number;   // upcoming + in_progress
  total_cancelled_shifts: number;
  completion_rate: number;        // 0-100, rounded: completed / (total - cancelled)
}
```

### Example

```
GET /api/v1/client/shift-stats?range=this_week
```

```json
{
  "success": true,
  "message": "Client shift stats retrieved successfully",
  "data": {
    "range": "this_week",
    "date_from": "2026-09-13T00:00:00.000Z",
    "date_to": "2026-09-19T23:59:59.999Z",
    "total_shifts": 12,
    "total_completed_shifts": 7,
    "total_pending_shifts": 4,
    "total_cancelled_shifts": 1,
    "completion_rate": 64
  }
}
```

---

## 3. `GET /client/totals`

Static, all-time inventory counts. Changes rarely — safe to cache on the frontend (e.g. fetch once per session, or revalidate every few minutes).

**Query params**: none

### Response `data`

```ts
{
  total_cleaning_plans: number;
  total_locations: number;
  total_rooms: number;
  total_tasks: number;
}
```

### Example

```json
{
  "success": true,
  "message": "Client totals retrieved successfully",
  "data": {
    "total_cleaning_plans": 3,
    "total_locations": 2,
    "total_rooms": 24,
    "total_tasks": 96
  }
}
```

---

## 4. `GET /client/roster`

A day/week/month schedule **grouped by cleaning plan** (not by worker — that's the manager-facing `GET /shift/roster`). Returns a page of the client's cleaning plans, and under each plan, every shift that falls in the selected window.

Merges already-materialized `Shift` documents with **virtual** (not-yet-materialized) occurrences projected from the plan's recurring tasks — same underlying data `/client/schedule-roster` uses, just reshaped by plan instead of by single day.

### Query params

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `view` | string | no | `day` | `day` \| `week` \| `month` |
| `date` | ISO date string | no | today | Anchor for `day`/`week`. Ignored for `month`. |
| `year` | number | no | current year | Anchor for `month` |
| `month` | number (1-12) | no | current month | Anchor for `month` |
| `page` | number | no | `1` | Paginates the **cleaning plan list**, not shifts |
| `limit` | number | no | `10` | 1-50 plans per page |

`week` = Sunday → Saturday containing `date`. `month` = full calendar month for `year`/`month`.

### Response `data`

```ts
{
  view: "day" | "week" | "month";
  start_date: string;   // ISO date-time, inclusive UTC window start
  end_date: string;     // ISO date-time, exclusive UTC window end
  meta: {
    page: number;
    limit: number;
    total: number;          // total cleaning plans for this client, all pages
    totalPage: number;
    total_shifts: number;   // total shift entries across every plan on this page
  };
  cleaning_plans: Array<{
    plan_id: string;
    plan_title: string;
    location_name: string;
    total_shifts_in_range: number;
    total_hours_in_range: number;
    shifts: Array<{
      date: string;                 // "2026-09-15"
      shift_id: string | null;      // null when is_virtual is true
      is_virtual: boolean;          // true = projected from the plan, not yet a real DB row
      status: "upcoming" | "in_progress" | "completed" | "cancelled";
      start_time: string;           // ISO date-time
      end_time: string;             // ISO date-time
      duration_minutes: number;
      rooms: { total: number; completed: number };
      tasks: { total: number; completed: number };
      assigned_workers: Array<{
        worker_id: string;
        name: string;
        role: "Team leader" | "Co-leader" | "Normal worker";
      }>;
    }>;
  }>;
}
```

A virtual shift (`is_virtual: true`) always has `shift_id: null`, `status: "upcoming"`, and `rooms.completed`/`tasks.completed` at `0` — nothing has happened yet, it's just a projection of what will occur.

### Example

```
GET /api/v1/client/roster?view=week
```

```json
{
  "success": true,
  "message": "Client plan roster retrieved successfully",
  "data": {
    "view": "week",
    "start_date": "2026-09-13T00:00:00.000Z",
    "end_date": "2026-09-20T00:00:00.000Z",
    "meta": { "page": 1, "limit": 10, "total": 2, "totalPage": 1, "total_shifts": 5 },
    "cleaning_plans": [
      {
        "plan_id": "66f1a2b3c4d5e6f7a8b9c0d1",
        "plan_title": "Downtown Office - Daily Clean",
        "location_name": "Downtown Office",
        "total_shifts_in_range": 5,
        "total_hours_in_range": 32.5,
        "shifts": [
          {
            "date": "2026-09-15",
            "shift_id": "66f1a2b3c4d5e6f7a8b9c0d2",
            "is_virtual": false,
            "status": "in_progress",
            "start_time": "2026-09-15T09:00:00.000Z",
            "end_time": "2026-09-15T15:30:00.000Z",
            "duration_minutes": 390,
            "rooms": { "total": 8, "completed": 3 },
            "tasks": { "total": 20, "completed": 9 },
            "assigned_workers": [
              { "worker_id": "66f1a2b3c4d5e6f7a8b9c0d3", "name": "Maria Gomez", "role": "Team leader" }
            ]
          },
          {
            "date": "2026-09-16",
            "shift_id": null,
            "is_virtual": true,
            "status": "upcoming",
            "start_time": "2026-09-16T09:00:00.000Z",
            "end_time": "2026-09-16T15:30:00.000Z",
            "duration_minutes": 390,
            "rooms": { "total": 8, "completed": 0 },
            "tasks": { "total": 20, "completed": 0 },
            "assigned_workers": [
              { "worker_id": "66f1a2b3c4d5e6f7a8b9c0d3", "name": "Maria Gomez", "role": "Team leader" }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Suggested frontend usage

| Dashboard section | Endpoint | Poll interval |
|---|---|---|
| Live progress ring, on-site team, worked hours | `/client/active-progress` | 30–60s while `status === 'active'`, else on-demand |
| Shift history cards / filter tabs (Today, This Week, This Month) | `/client/shift-stats?range=...` | on tab change / page load |
| Static inventory summary (plans, locations, rooms, tasks) | `/client/totals` | once per session |
| Schedule / calendar view, grouped by cleaning plan | `/client/roster?view=...` | on tab/date-range change |

Full interactive schema (try-it-out included) is also available at `/api-docs` (Swagger UI, tag: **Clients**), and the raw OpenAPI JSON at `/api-docs.json`.
