# Shift Management APIs

Base path: `/api/v1/shift`. Manager endpoints require `Authorization: Bearer <manager-access-token>`. The `/my-shifts` endpoint requires a worker access token.

A **Shift** is a single-day occurrence of a `CleaningPlan`, derived from the recurrence (`frequency_type`/`days_of_week`/`days_of_month`) of the active `Task` documents on that plan's rooms. See `docs/SHIFT_MANAGEMENT_DESIGN.md` for how occurrences, materialization, and conflict-checking work.

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/my-shifts?date=YYYY-MM-DD` | List the authenticated worker's shifts for one date |
| GET | `/:planId` | List a plan's occurrences in a date range |
| GET | `/:planId/:date` | Get one occurrence |
| PATCH | `/:planId/:date/assign-workers` | Replace workers for one specific occurrence |
| PATCH | `/:planId/:date/status` | Update one occurrence's status |

`:date` is always an ISO calendar date (`YYYY-MM-DD`). `:planId` is a `CleaningPlan` ID.

## Virtual vs. real shifts

Every response includes `is_virtual`:
- `is_virtual: true` — this occurrence has **not been saved** yet. It's computed live from the plan's current `rooms`/`assigned_workers`/duration. Nothing was written to the database for this read.
- `is_virtual: false` — a real `Shift` document exists (created either by a prior manager edit or by the daily materialization job).

Any **write** endpoint (`assign-workers`, `status`) materializes the shift first if it's still virtual, then applies the change to the now-real document.

## `GET /api/v1/shift/my-shifts?date=2026-09-13`

Requires a worker access token. `date` is required and must be a valid UTC calendar date in `YYYY-MM-DD` format. Worker identity comes from authentication; no worker ID is accepted.

Returns `200` with `{ "success": true, "message": "Shifts retrieved successfully", "data": [...] }`. Each item uses the shift shape shown below, sorted by `date_time` ascending. No assignments returns `data: []`.

- Includes saved shifts assigned to this worker, including completed and cancelled shifts, regardless of the parent plan's current activity or assignment.
- Includes virtual occurrences from active (`is_active: true`), non-completed plans assigned to this worker when task recurrence matches the requested date.
- A saved shift always overrides plan defaults. If a manager removed this worker from that occurrence, it will not reappear as a virtual shift.
- This read does not save shifts. Past virtual occurrences reflect current plan settings, not historical snapshots.
- Missing, malformed, or impossible dates return `400`. Authentication and account checks use the existing worker middleware.

---

## `GET /api/v1/shift/:planId`

List every occurrence between two dates.

**Query params**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `from` | date (`YYYY-MM-DD`) | today | Range start (inclusive) |
| `to` | date (`YYYY-MM-DD`) | `from` + 30 days | Range end (inclusive) |

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Shifts retrieved successfully",
  "data": [
    {
      "cleaning_plan": "6520f1a2b3c4d5e6f7890999",
      "date": "2026-02-09T00:00:00.000Z",
      "date_time": "2026-02-09T09:00:00.000Z",
      "rooms": ["6520f1a2b3c4d5e6f7890010"],
      "duration_minutes": 60,
      "assigned_workers": [
        { "worker": "6520f1a2b3c4d5e6f7890123", "role": "Team leader", "assigned_with_conflict": false }
      ],
      "is_worker_overridden": false,
      "status": "upcoming",
      "is_virtual": true
    },
    {
      "_id": "6520f1a2b3c4d5e6f78909aa",
      "cleaning_plan": "6520f1a2b3c4d5e6f7890999",
      "date": "2026-02-11T00:00:00.000Z",
      "date_time": "2026-02-11T09:00:00.000Z",
      "rooms": ["6520f1a2b3c4d5e6f7890010"],
      "duration_minutes": 60,
      "assigned_workers": [
        { "worker": "6520f1a2b3c4d5e6f7890124", "role": "Team leader", "assigned_with_conflict": false }
      ],
      "is_worker_overridden": true,
      "status": "upcoming",
      "is_virtual": false
    }
  ]
}
```

**Notes**

- Dates the plan doesn't occur on (per its rooms' task recurrence) are **omitted entirely** — you won't see empty placeholder entries for non-occurring days.
- `_id` is only present on real (`is_virtual: false`) entries.
- `404` if the plan ID doesn't exist.

---

## `GET /api/v1/shift/:planId/:date`

Get a single occurrence.

**Path params**

| Name | Type | Description |
| --- | --- | --- |
| `planId` | ObjectId | Cleaning plan ID |
| `date` | string | ISO date `YYYY-MM-DD` |

**Response — `200 OK`**: same shape as one item from the list endpoint.

**`404`** if the plan doesn't exist, or the plan has no occurrence on that date at all.

---

## `PATCH /api/v1/shift/:planId/:date/assign-workers`

Replace the assigned workers for **this occurrence only** — the plan's default assignment (and every other occurrence) is untouched.

**Request body**

```json
{
  "assigned_workers": [
    { "worker": "6520f1a2b3c4d5e6f7890124", "role": "Team leader" }
  ],
  "force": false
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assigned_workers` | array | yes, min 1 | Each item: `{ worker: ObjectId, role }` |
| `assigned_workers[].role` | string | yes | `"Team leader"` \| `"Co-leader"` \| `"Normal worker"` |
| `force` | boolean | no | Also accepted as `?force=true`. Assign despite a scheduling conflict. |

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Shift workers assigned successfully",
  "data": {
    "_id": "6520f1a2b3c4d5e6f78909aa",
    "cleaning_plan": "6520f1a2b3c4d5e6f7890999",
    "date": "2026-02-11T00:00:00.000Z",
    "date_time": "2026-02-11T09:00:00.000Z",
    "assigned_workers": [
      { "worker": "6520f1a2b3c4d5e6f7890124", "role": "Team leader", "assigned_with_conflict": false }
    ],
    "is_worker_overridden": true,
    "status": "upcoming"
  }
}
```

This call **materializes** the shift first (if it was still virtual) — the plan's current `rooms`/duration are snapshotted onto the new `Shift` document at that moment, then the submitted `assigned_workers` replace its worker list, and `is_worker_overridden` is set to `true`.

**Response — `400 Bad Request`** — ineligible worker(s), never overridable by `force` (identical semantics to the plan-level endpoint):

```json
{
  "success": false,
  "message": "Worker(s) account is blocked/inactive: 6520f1a2b3c4d5e6f7890126",
  "errorDetails": {}
}
```

**Response — `409 Conflict`** — scheduling conflict(s) and `force` was not set:

```json
{
  "success": false,
  "message": "One or more workers have a scheduling conflict. Pass force=true to assign anyway.",
  "errorDetails": {
    "conflicts": [
      {
        "worker": "6520f1a2b3c4d5e6f7890124",
        "reason": "double_booked",
        "conflicting_plan_id": "6520f1a2b3c4d5e6f7890888"
      }
    ]
  }
}
```

`conflicting_plan_id` here may point to another plan whose occurrence on this same date hasn't been materialized into a Shift yet — the conflict check covers both materialized shifts and not-yet-materialized plan occurrences for the same worker on the same date.

Retry with `"force": true` to proceed anyway.

**Other errors**: `400` if this plan has no occurrence on the given date; `404` if the plan doesn't exist; `401`/`403` if not an authenticated manager.

---

## `PATCH /api/v1/shift/:planId/:date/status`

**Request body**

```json
{ "status": "completed" }
```

`status` is one of `"upcoming"`, `"in_progress"`, `"completed"`, `"cancelled"`.

**Response — `200 OK`**: the updated `Shift` document (same shape as above).

This call also materializes the shift first if it was still virtual. There is no workflow enforcement on status transitions (e.g. `upcoming` → `completed` directly is allowed) — any value can be set at any time.

**Other errors**: same as `assign-workers` (`400`/`404`/`401`/`403`), minus the conflict-related ones (status updates don't touch `assigned_workers`).
