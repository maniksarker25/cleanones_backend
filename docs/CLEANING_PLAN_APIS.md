# Cleaning Plan APIs — Worker Assignment & Availability

Base path: `/api/v1/cleaning-plan`. All endpoints in this document require `Authorization: Bearer <manager-access-token>`.

This document covers the worker-assignment/availability feature: `GET /:id/eligible-workers` and `PATCH /:id/assign-workers`, plus the fields on the base Cleaning Plan CRUD that support them (`max_estimated_duration`, `end_date`, `force`, `assigned_with_conflict`).

## Concepts

- **`max_estimated_duration`** (minutes) is **server-computed**, never accepted from the client. Whenever `rooms` is set/changed on create or update, it's recalculated as the sum of `duration_minutes` across every active `Task` document belonging to those rooms. This is a deliberate **conservative upper bound** (it assumes every task could land on the same day), used as the time-window width for conflict checks — not a per-day-accurate duration.
- **`end_date`** (optional) bounds how far into the future a plan's recurrence is considered for conflict checking. Omit or set `null` for an indefinite plan; conflict checks then fall back to a 90-day rolling horizon internally.
- A plan's actual **occurrence pattern** (which calendar days it happens on) is derived from the `frequency_type` / `days_of_week` / `days_of_month` of the active `Task` documents on its `rooms` — not stored on the plan itself. A plan with rooms that have no active tasks is treated as never occurring and never conflicts with anything.
- **`is_conflict`** / **`assigned_with_conflict`** describe a scheduling overlap (the worker is booked on another active plan whose occurrence + time window collides with this one) — **not** an eligibility problem. Deleted, blocked, or inactive workers are never returned as "conflicted"; they're excluded from the eligible list entirely and hard-rejected on assignment, with no `force` override possible.

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/:id/eligible-workers` | Preview which workers are free/conflicted for an existing plan |
| PATCH | `/:id/assign-workers` | Replace `assigned_workers`, enforcing the same conflict check |
| POST | `/create-cleaning-plan` | Create a plan (accepts `assigned_workers` + `force` directly too) |
| PATCH | `/update-cleaning-plan/:id` | Update a plan (same `assigned_workers` + `force` behavior) |

---

## `GET /api/v1/cleaning-plan/:id/eligible-workers`

Returns every eligible worker for the given (already-existing) plan, each annotated with whether assigning them would conflict.

**Path params**

| Name | Type | Description |
| --- | --- | --- |
| `id` | ObjectId | Cleaning plan ID |

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Eligible workers retrieved successfully",
  "data": [
    {
      "worker": {
        "_id": "6520f1a2b3c4d5e6f7890123",
        "email": "worker1@example.com",
        "worker_type": "Employee",
        "working_days": ["mon", "wed", "fri"],
        "...": "full Worker document"
      },
      "is_conflict": false,
      "conflict_reason": null,
      "conflicting_plan_id": null
    },
    {
      "worker": { "_id": "6520f1a2b3c4d5e6f7890124", "...": "..." },
      "is_conflict": true,
      "conflict_reason": "double_booked",
      "conflicting_plan_id": "6520f1a2b3c4d5e6f7890999"
    }
  ]
}
```

**Notes**

- Workers with `isDeleted: true` (on the Worker profile) or a linked User that is `isDeleted`/`isBlocked`/not `isActive` are **omitted from the list entirely** — they never appear, conflicted or not.
- This plan itself is always excluded from its own conflict search (a worker already assigned to this exact plan won't be flagged as conflicting with it).
- `conflict_reason` is currently always `"double_booked"` when `is_conflict` is `true`, or `null` otherwise.
- `404` if the plan ID doesn't exist.

---

## `PATCH /api/v1/cleaning-plan/:id/assign-workers`

Replaces the plan's `assigned_workers` list, enforcing eligibility and (unless overridden) scheduling-conflict checks.

**Path params**

| Name | Type | Description |
| --- | --- | --- |
| `id` | ObjectId | Cleaning plan ID |

**Request body**

```json
{
  "assigned_workers": [
    { "worker": "6520f1a2b3c4d5e6f7890123", "role": "Team leader" },
    { "worker": "6520f1a2b3c4d5e6f7890124", "role": "Normal worker" }
  ],
  "force": false
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assigned_workers` | array | yes, min 1 | Each item: `{ worker: ObjectId, role }` |
| `assigned_workers[].role` | string | yes | One of `"Team leader"`, `"Co-leader"`, `"Normal worker"` |
| `force` | boolean | no | Also accepted as `?force=true` query param. Assign despite scheduling conflicts. |

**Response — `200 OK`** (success, or `force: true` used)

```json
{
  "success": true,
  "message": "Workers assigned successfully",
  "data": {
    "_id": "6520f1a2b3c4d5e6f7890999",
    "assigned_workers": [
      { "worker": "6520f1a2b3c4d5e6f7890123", "role": "Team leader", "assigned_with_conflict": false },
      { "worker": "6520f1a2b3c4d5e6f7890124", "role": "Normal worker", "assigned_with_conflict": true }
    ],
    "...": "full CleaningPlan document"
  }
}
```

`assigned_with_conflict: true` on an entry means that worker was force-assigned despite a detected conflict — kept for audit purposes.

**Response — `400 Bad Request`** — ineligible worker(s), never overridable by `force`:

```json
{
  "success": false,
  "message": "Worker(s) not found or deleted: 6520f1a2b3c4d5e6f7890125",
  "errorDetails": {}
}
```

or

```json
{
  "success": false,
  "message": "Worker(s) account is blocked/inactive: 6520f1a2b3c4d5e6f7890126",
  "errorDetails": {}
}
```

**Response — `409 Conflict`** — scheduling conflict(s) found and `force` was not set:

```json
{
  "success": false,
  "message": "One or more workers have a scheduling conflict. Pass force=true to assign anyway.",
  "errorDetails": {
    "conflicts": [
      {
        "worker": "6520f1a2b3c4d5e6f7890124",
        "reason": "double_booked",
        "conflicting_plan_id": "6520f1a2b3c4d5e6f7890999"
      }
    ]
  }
}
```

Retry the same request with `"force": true` (or `?force=true`) to proceed anyway — the conflicting entries will be saved with `assigned_with_conflict: true`.

**Other errors**

- `404` if the plan ID doesn't exist.
- `401`/`403` if the caller is not an authenticated manager.

---

## Interaction with `create-cleaning-plan` / `update-cleaning-plan`

`assigned_workers` and `force` are also accepted directly in the create/update payloads (a manager can assign workers while creating or editing a plan, not only via the dedicated endpoint). The same rules apply:

- Ineligible workers → `400`, never overridable.
- Scheduling conflicts without `force: true` → `409` with the same `errorDetails.conflicts` shape.
- With `force: true`, conflicted entries are saved with `assigned_with_conflict: true`.

`max_estimated_duration` is silently recomputed server-side whenever `rooms` is present in the create/update payload; any client-supplied value for it is ignored.

Example create payload showing the relevant fields:

```json
{
  "title": "Weekly office deep clean",
  "description": "Full deep clean of the head office.",
  "client": "6520f1a2b3c4d5e6f7890001",
  "location": "6520f1a2b3c4d5e6f7890002",
  "rooms": ["6520f1a2b3c4d5e6f7890010", "6520f1a2b3c4d5e6f7890011"],
  "date_time": "2026-01-05T09:00:00.000Z",
  "end_date": "2026-06-30T00:00:00.000Z",
  "assigned_workers": [
    { "worker": "6520f1a2b3c4d5e6f7890123", "role": "Team leader" }
  ],
  "force": false
}
```
