# Client Roster API

`GET /api/v1/client/roster`

A day/week/month schedule **grouped by cleaning plan**. For each of the client's cleaning plans, shows every shift that falls inside the selected time window — real shifts already in the database, plus "virtual" shifts (upcoming occurrences the system has calculated from the plan's schedule but hasn't created a database record for yet).

> Note: there's a similar-looking manager-only endpoint `GET /shift/roster`, but that one is grouped **by worker** (which worker has which shifts). This one is grouped **by cleaning plan** and is for the client role only.

---

## Auth

| | |
|---|---|
| Header | `Authorization: Bearer <token>` |
| Role required | `client` |

No client ID is passed in the URL — the endpoint resolves the authenticated user's own client profile automatically.

---

## Query params

| Param | Type | Required | Default | Values / Notes |
|---|---|---|---|---|
| `view` | string | no | `day` | `day` \| `week` \| `month` — size of the time window |
| `date` | string (`YYYY-MM-DD`) | no | today | Anchor date for `view=day` or `view=week`. Ignored when `view=month`. |
| `year` | number | no | current year | Anchor year for `view=month` |
| `month` | number | no | current month | Anchor month (1–12) for `view=month` |
| `page` | number | no | `1` | Paginates the **list of cleaning plans**, not the shifts inside them |
| `limit` | number | no | `10` | Cleaning plans per page, 1–50 |

**How the window is calculated:**
- `day` → just that one calendar day
- `week` → Sunday through Saturday, the week containing `date`
- `month` → the full calendar month for `year`/`month`

### Example requests

```
GET /api/v1/client/roster
GET /api/v1/client/roster?view=week
GET /api/v1/client/roster?view=week&date=2026-09-15
GET /api/v1/client/roster?view=month&year=2026&month=9
GET /api/v1/client/roster?view=week&page=2&limit=5
```

---

## Response

Standard envelope:

```json
{
  "success": true,
  "message": "Client plan roster retrieved successfully",
  "data": { }
}
```

### `data` shape

```ts
{
  view: "day" | "week" | "month";
  start_date: string;   // ISO date-time — inclusive start of the window (UTC)
  end_date: string;     // ISO date-time — exclusive end of the window (UTC)

  meta: {
    page: number;
    limit: number;
    total: number;          // total cleaning plans this client has, across ALL pages
    totalPage: number;
    total_shifts: number;   // total shift entries across every plan on THIS page
  };

  cleaning_plans: Array<{
    plan_id: string;
    plan_title: string;
    location_name: string;
    total_shifts_in_range: number;   // how many shifts this plan has in the window
    total_hours_in_range: number;    // sum of duration_minutes / 60 for this plan's shifts

    shifts: Array<{
      date: string;                  // "2026-09-15"
      shift_id: string | null;       // null when is_virtual is true
      is_virtual: boolean;           // true = projected/upcoming, not a real DB record yet
      status: "upcoming" | "in_progress" | "completed" | "cancelled";
      start_time: string;            // ISO date-time
      end_time: string;              // ISO date-time
      duration_minutes: number;

      rooms: {
        total: number;
        completed: number;           // a room counts as completed once all its tasks are done
      };
      tasks: {
        total: number;
        completed: number;
      };

      assigned_workers: Array<{
        worker_id: string;
        name: string;
        role: "Team leader" | "Co-leader" | "Normal worker";
      }>;
    }>;
  }>;
}
```

### Reading `is_virtual`

- `is_virtual: false` → a real shift that exists in the database. Has real `rooms.completed` / `tasks.completed` progress, a real `shift_id`, and its `status` reflects what's actually happening.
- `is_virtual: true` → nothing has happened yet — this is just "here's when the next cleaning is expected to occur, based on the plan's schedule." Always: `shift_id: null`, `status: "upcoming"`, `rooms.completed: 0`, `tasks.completed: 0`.

Frontend should render both the same way visually (they're just calendar entries), but only real shifts (`is_virtual: false`) should show a progress bar / completion state — a virtual shift has nothing to show progress for yet.

---

## Full example

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
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPage": 1,
      "total_shifts": 5
    },
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
              {
                "worker_id": "66f1a2b3c4d5e6f7a8b9c0d3",
                "name": "Maria Gomez",
                "role": "Team leader"
              }
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
              {
                "worker_id": "66f1a2b3c4d5e6f7a8b9c0d3",
                "name": "Maria Gomez",
                "role": "Team leader"
              }
            ]
          }
        ]
      },
      {
        "plan_id": "66f1a2b3c4d5e6f7a8b9c0d9",
        "plan_title": "Warehouse - Weekly Deep Clean",
        "location_name": "North Warehouse",
        "total_shifts_in_range": 0,
        "total_hours_in_range": 0,
        "shifts": []
      }
    ]
  }
}
```

*(A plan with `shifts: []` just means nothing is scheduled for it in this particular window — still show the plan card, just with an empty state.)*

---

## Errors

| Status | Meaning |
|---|---|
| 400 | Invalid `view`, `year`, `month`, `page`, or `limit` value |
| 401 | Missing/invalid/expired token, or role isn't `client` |
| 403 | Account blocked or inactive |
| 404 | Authenticated client profile not found |
| 429 | Rate limited |
| 500 | Server error |

Error shape:

```json
{
  "success": false,
  "message": "view must be one of 'day', 'week', 'month'",
  "errorSources": [{ "path": "string", "message": "string" }]
}
```

---

## Suggested UI mapping

- Use this to power a **calendar / schedule view**, one card per cleaning plan, with a mini timeline or list of its shifts for the selected day/week/month.
- Tab or dropdown for `view` (Day / Week / This Month), with a date picker feeding `date` (or `year`+`month` for the month view).
- Re-fetch on every `view`/`date` change — this endpoint is not meant to be polled continuously (unlike `/client/active-progress`).
- If a client has more than ~10 cleaning plans, wire up `page`/`limit` for the plan list (most clients will have very few plans, so pagination controls can likely stay hidden until `meta.totalPage > 1`).

Interactive schema (try-it-out) is also available at `/api-docs` (Swagger UI → **Clients** tag → `GET /client/roster`).
