# Shift Management APIs

Base path: `/api/v1/shift`. Manager endpoints require `Authorization: Bearer <manager-access-token>`. `/my-shifts`, the photo-upload endpoint, and check-in/check-out require a worker access token.

A **Shift** is a single-day occurrence of a `CleaningPlan`, derived from the recurrence (`frequency_type`/`days_of_week`/`days_of_month`) of the active `Task` documents on that plan's rooms. See `docs/SHIFT_MANAGEMENT_DESIGN.md` for how occurrences, materialization, snapshotting, and conflict-checking work.

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/my-shifts?date=YYYY-MM-DD` | List the authenticated worker's shifts for one date |
| GET | `/:planId` | List a plan's occurrences in a date range |
| GET | `/:planId/:date` | Get one occurrence |
| PATCH | `/:planId/:date/assign-workers` | Replace workers for one specific occurrence |
| PATCH | `/:planId/:date/status` | Update one occurrence's status |
| PATCH | `/:planId/:date/tasks/:taskId/photo` | Upload a required photo for one shift task (worker) |
| PATCH | `/:planId/:date/check-in` | Check in to an already-materialized shift (worker) |
| PATCH | `/:planId/:date/check-out` | Check out from an already-materialized shift (worker) |

`:date` is always an ISO calendar date (`YYYY-MM-DD`). `:planId` is a `CleaningPlan` ID. `:taskId` is the source `Task`'s ID (matches a `tasks[].task` entry on the shift).

## The Shift shape

Every shift response (real or virtual) looks like this:

```json
{
  "_id": "6520f1a2b3c4d5e6f78909aa",
  "cleaning_plan": "6520f1a2b3c4d5e6f7890999",
  "date": "2026-02-11T00:00:00.000Z",
  "date_time": "2026-02-11T09:00:00.000Z",
  "location": {
    "location": "6520f1a2b3c4d5e6f7890002",
    "name": "Downtown Office",
    "coordinates": { "type": "Point", "coordinates": [90.4125, 23.8103] }
  },
  "rooms": [
    { "room": "6520f1a2b3c4d5e6f7890010", "name": "Lobby", "room_type": "common" }
  ],
  "tasks": [
    {
      "task": "6520f1a2b3c4d5e6f7890030",
      "room": "6520f1a2b3c4d5e6f7890010",
      "name": "Vacuum carpet",
      "duration_minutes": 20,
      "is_photo_required": true,
      "photo_requirements": [
        { "title": "Before cleaning", "photo_url": null, "is_uploaded": false },
        { "title": "After cleaning", "photo_url": null, "is_uploaded": false }
      ],
      "is_completed": false,
      "completed_at": null,
      "status": "UPCOMING"
    }
  ],
  "duration_minutes": 60,
  "assigned_workers": [
    {
      "worker": "6520f1a2b3c4d5e6f7890124",
      "name": "Rafiq Islam",
      "role": "Team leader",
      "assigned_with_conflict": false,
      "check_in_at": null,
      "check_in_coordinates": null,
      "check_out_at": null,
      "check_out_coordinates": null
    }
  ],
  "is_worker_overridden": false,
  "status": "upcoming",
  "is_virtual": true
}
```

**`rooms`, `tasks`, and `assigned_workers` are frozen snapshots**, taken the moment the shift materializes (or, for a still-virtual shift, computed fresh from the plan's *current* state on every read). `room`/`task`/`worker` inside each entry are kept only for traceability — never re-resolve `name`/`room_type`/`photo_requirements` by looking up the live Room/Task/Worker document; the snapshot is authoritative for what happened (or is planned) on that specific day, even if the source document is later renamed, edited, or deactivated.

**`tasks[].is_completed` is fully automatic** — it becomes `true` the moment every entry in that task's `photo_requirements` has `is_uploaded: true` (or immediately, if `is_photo_required` is `false`). There is no manual "mark complete" action and no manager approval step.

**`tasks[].status`** (`"UPCOMING"` | `"IN_PROGRESS"` | `"COMPLETED"`) is a separate, independent field — it always starts at `"UPCOMING"` when the task instance is materialized. There is currently no endpoint or automatic logic that transitions it; that's a deliberate placeholder for now.

**`location`** is a frozen snapshot of the plan's Location, taken at materialization time — this is the geofence center check-in/check-out validate against. `coordinates` is `null` if the source Location has no GPS point configured.

## Virtual vs. real shifts

Every response includes `is_virtual`:
- `is_virtual: true` — this occurrence has **not been saved** yet. It's computed live from the plan's current rooms/tasks/workers. Nothing was written to the database for this read.
- `is_virtual: false` — a real `Shift` document exists (created by a prior manager edit, a worker's photo upload, or the daily materialization job).

Any **write** endpoint (`assign-workers`, `status`, the photo upload) materializes the shift first if it's still virtual, then applies the change to the now-real document.

---

## `GET /api/v1/shift/my-shifts?date=2026-09-13`

Requires a worker access token. `date` is required and must be a valid UTC calendar date in `YYYY-MM-DD` format. Worker identity comes from authentication; no worker ID is accepted.

Returns `200` with `{ "success": true, "message": "Shifts retrieved successfully", "data": [...] }`. Each item uses the shift shape above, sorted by `date_time` ascending. No assignments returns `data: []`.

- Includes saved shifts assigned to this worker, including completed and cancelled shifts, regardless of the parent plan's current activity or assignment.
- Includes virtual occurrences from active (`is_active: true`), non-completed plans assigned to this worker when task recurrence matches the requested date.
- A saved shift always overrides plan defaults. If a manager removed this worker from that occurrence, it will not reappear as a virtual shift.
- This read does not save shifts. Past virtual occurrences reflect current plan settings, not historical snapshots (only a materialized shift is a true historical record).
- Missing, malformed, or impossible dates return `400`.

---

## `GET /api/v1/shift/:planId`

List every occurrence between two dates.

**Query params**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `from` | date (`YYYY-MM-DD`) | today | Range start (inclusive) |
| `to` | date (`YYYY-MM-DD`) | `from` + 30 days | Range end (inclusive) |

**Response — `200 OK`**: `{ success, message, data: Shift[] }` (see shape above).

**Notes**

- Dates the plan doesn't occur on (per its rooms' task recurrence) are **omitted entirely** — you won't see empty placeholder entries for non-occurring days.
- `_id` is only present on real (`is_virtual: false`) entries.
- `404` if the plan ID doesn't exist.

---

## `GET /api/v1/shift/:planId/:date`

Get a single occurrence. Same shape as one item from the list endpoint.

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
| `assigned_workers` | array | yes, min 1 | Each item: `{ worker: ObjectId, role }` — `name` is resolved server-side, never accepted from the client |
| `assigned_workers[].role` | string | yes | `"Team leader"` \| `"Co-leader"` \| `"Normal worker"` |
| `force` | boolean | no | Also accepted as `?force=true`. Assign despite a scheduling conflict. |

This call **materializes** the shift first (if it was still virtual), resolves each worker's current `name` from their profile to snapshot onto the entry, replaces `assigned_workers`, and sets `is_worker_overridden: true`.

**Response — `400 Bad Request`** — ineligible worker(s), never overridable by `force`:

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

This call also materializes the shift first if it was still virtual. There is no workflow enforcement on status transitions (e.g. `upcoming` → `completed` directly is allowed) — any value can be set at any time.

**Other errors**: `400` if this plan has no occurrence on the given date; `404` if the plan doesn't exist; `401`/`403` if not an authenticated manager.

---

## `PATCH /api/v1/shift/:planId/:date/tasks/:taskId/photo`

Requires a worker access token. Records a photo submission for one specific task instance within one specific shift.

**Path params**

| Name | Type | Description |
| --- | --- | --- |
| `planId` | ObjectId | Cleaning plan ID |
| `date` | string | ISO date `YYYY-MM-DD` |
| `taskId` | ObjectId | The source Task's ID — must match a `tasks[].task` entry on this shift |

**Request body**

```json
{ "title": "Before cleaning", "photo_url": "https://cdn.example.com/uploads/abc123.jpg" }
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | Must match one of that task instance's `photo_requirements[].title` exactly |
| `photo_url` | string | yes | URL of the already-uploaded file — upload the file itself via the file-upload module first, then submit its resulting URL here |

This call materializes the shift first if it was still virtual. The matching `photo_requirements` entry is set to `{ photo_url, is_uploaded: true }`, then `is_completed`/`completed_at` on that task instance is recomputed automatically from the full set of that task's requirements.

**Response — `200 OK`**: the updated `Shift` document (see shape above).

**Errors**:
- `403` if the calling worker is not in this shift's `assigned_workers`.
- `400` if `title` doesn't match any of that task's requirements, or if this plan has no occurrence on the given date.
- `404` if the plan doesn't exist, or `taskId` doesn't match any task instance on this shift.
- `401`/`403` if not an authenticated worker.

---

## `PATCH /api/v1/shift/:planId/:date/check-in` and `.../check-out`

Requires a worker access token. Records the calling worker's check-in or check-out time and GPS position for a shift.

**These two endpoints are the one exception to "writes materialize a virtual shift."** They only ever operate on an **already-materialized** shift (created earlier by the daily cron or a manager edit) — if no `Shift` document exists yet for `(planId, date)`, this returns `404`, it does **not** create one. There's no reason to check into a shift that hasn't happened yet, and check-in only makes practical sense for today, by which point the cron has already materialized it.

There is **no time-window restriction** — check-in/check-out is valid any time on the shift's date, only the location is validated.

**Path params**

| Name | Type | Description |
| --- | --- | --- |
| `planId` | ObjectId | Cleaning plan ID |
| `date` | string | ISO date `YYYY-MM-DD` |

**Request body**

```json
{ "latitude": 23.8103, "longitude": 90.4125 }
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `latitude` | number | yes | -90 to 90 |
| `longitude` | number | yes | -180 to 180 |

**Validation applied (both endpoints)**:
1. The shift must already exist (materialized) — `404` otherwise.
2. The calling worker must be in that shift's `assigned_workers` — `403` otherwise.
3. The submitted coordinates must be within **50 meters** (Haversine distance) of the shift's frozen `location.coordinates` — `400` otherwise, with the actual distance included in the message. If the shift's location has no GPS point configured at all, this always fails with `400` (geofencing can't be silently skipped).
4. Check-in additionally requires the worker hasn't already checked in (`400` if so). Check-out additionally requires the worker has already checked in and hasn't already checked out (`400` if either is violated).

**Response — `200 OK`**: the updated `Shift` document, with `assigned_workers[].check_in_at`/`check_in_coordinates` (or the `check_out_*` equivalents) set.

```json
{
  "success": true,
  "message": "Checked in successfully",
  "data": { "...": "full Shift document" }
}
```

**Errors**: `400` (geofence failure, missing coordinates on the location, or invalid check-in/out sequencing), `403` (not assigned to this shift), `404` (shift not materialized yet, or plan doesn't exist), `401`/`403` (not an authenticated worker).
