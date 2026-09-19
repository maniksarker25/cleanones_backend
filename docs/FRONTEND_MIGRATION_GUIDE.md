# Frontend Migration Guide — Cleaning Plan / Shift Redesign

**Audience:** frontend developers integrating against this API.
**Date:** September 2026.

## 1. What changed, conceptually

**Before:** a Cleaning Plan carried its own `date_time`, `end_date`, and `assigned_workers`. A background cron auto-created ("materialized") a Shift for every plan every day, pre-filled with the plan's default crew and time.

**Now:** a Cleaning Plan is a pure blueprint — client, location, rooms, and (via the rooms' Tasks) the recurring checklist. **It has no schedule and no crew of its own.**

Instead:

- Each **Task** carries its own recurrence (`daily` / specific weekdays / specific days of month), so "which dates are due" comes from the tasks, not the plan.
- A **Shift** (one calendar day's occurrence) is now only ever created the moment a manager **staffs** it — picks the workers *and* sets a start/end time in one action. There is no more background job creating empty shifts.
- Any due date that hasn't been staffed yet is shown as a **virtual, unstaffed placeholder** (`is_virtual: true`, `status: "unstaffed"`) — no time, no crew — rather than a real database record.

This is the single mental model to carry into every screen below: **"due" and "staffed" are two different things**, and only staffed occurrences have a real time or crew.

---

## 2. Endpoints removed

These no longer exist. Remove any calls to them.

| Method | Path | Replacement |
|---|---|---|
| `PATCH` | `/cleaning-plan/{id}/assign-workers` | `PATCH /shift/{planId}/{date}/assign-workers` (per due date, not per plan) |
| `GET` | `/cleaning-plan/{id}/eligible-workers` | `GET /shift/{planId}/{date}/eligible-workers` (per due date, see §4) |

---

## 3. Endpoints with a changed request or response shape

### 3.1 Cleaning Plan — request body no longer takes schedule/crew

`POST /cleaning-plan/create-cleaning-plan` and `PATCH /cleaning-plan/update-cleaning-plan/{id}`:

**Remove these fields from your request payload** — they're rejected/ignored now:
- `date_time`
- `end_date`
- `assigned_workers`
- `force`

**Still send:** `title`, `description`, `client`, `location`, `rooms`, `note`, `status`.

### 3.2 Cleaning Plan — response no longer includes schedule/crew

`GET /cleaning-plan/all-cleaning-plans`, `GET /cleaning-plan/single-cleaning-plan/{id}`, `GET /cleaning-plan/get-my-cleaning-plans`:

**These fields are gone from the response:**
- `date_time`, `end_date`
- `assigned_workers`
- `total_assigned_worker` / `total_assigned_workers`

Any UI that showed "assigned crew" or "start date" directly on the Cleaning Plan card must be removed or replaced — that information now lives on individual Shifts (see below).

**Duration fields on `GET /cleaning-plan/single-cleaning-plan/{id}` were also split out** (previously `total_duration` silently only counted regular room tasks, ignoring additional tasks):

| Field | Meaning |
|---|---|
| `total_task_duration` | Sum of the plan's regular room-task `duration_minutes` only. |
| `total_additional_task_duration` | **New.** Sum of every AdditionalTask's `duration_minutes` (any status). |
| `total_duration` | **Now the true grand total** — `total_task_duration + total_additional_task_duration`. |

If your UI showed `total_duration` as "total time for this plan," it will now be a bigger (correct) number once a plan has any additional tasks — update any hardcoded assumptions accordingly.

### 3.3 `PATCH /shift/{planId}/{date}/assign-workers` — now requires a schedule, and is the only way a Shift is created

**New required body fields:**

```jsonc
{
  "assigned_workers": [{ "worker": "<id>", "role": "Team leader" }],
  "start_time": "2026-09-20T09:00:00.000Z",   // NEW — required
  "end_time": "2026-09-20T13:00:00.000Z",     // NEW — required, must be after start_time
  "force": false                                // unchanged, optional
}
```

- Missing `start_time`/`end_time` → `400`.
- `end_time` not after `start_time` → `400`.
- **This single call is what creates the Shift the first time** a given date is staffed. Calling it again on the same date edits the existing shift's crew/schedule.
- Conflict behavior (double-booking) is unchanged: `409` with `errorDetails.conflicts` unless `force: true`.

### 3.4 Shift object shape — one field added, one removed

| Field | Change |
|---|---|
| `end_time` | **New.** The scheduled end, set by the manager alongside `date_time` at staffing time. Always present on any real Shift. |
| `is_worker_overridden` | **Removed.** No longer meaningful (there's no plan-level default to "override" anymore). |

### 3.5 Shift `status` — new value `"unstaffed"`

```
"upcoming" | "in_progress" | "completed" | "cancelled" | "unstaffed"
```

`"unstaffed"` **only ever appears on a virtual placeholder** (`is_virtual: true`), never on a real, persisted Shift document. A real Shift's status is always one of the original four.

### 3.6 Every "list shifts" endpoint — unstaffed due dates are now shaped differently

Applies to: `GET /shift/{planId}`, `GET /shift/{planId}/{date}`, `GET /shift/roster`, `GET /shift/plan-roster` (new, §4), `GET /client/roster`, `GET /client/schedule-roster`.

**Old behavior:** an un-materialized day showed a "virtual" preview with the plan's *default* time and crew filled in (so it looked staffed even when nobody had actually been assigned).

**New behavior:** an unstaffed due date shows:

```jsonc
{
  "is_virtual": true,
  "status": "unstaffed",
  "shift_id": null,
  "start_time": null,   // or field entirely absent, depending on endpoint — see per-endpoint notes below
  "end_time": null,
  "assigned_workers": []
}
```

**Frontend action needed:** wherever you render a shift/schedule row, branch on `is_virtual` (or `status === 'unstaffed'`) and render a "Not yet staffed" state instead of trying to show a time or crew avatar list. Don't assume `start_time`/`assigned_workers` are populated just because a row exists.

### 3.7 `GET /shift/roster` and worker-facing shift lists — staffed-only now

`GET /shift/roster`, `GET /shift/my-shifts`, `GET /shift/my-next-shift`, `GET /shift/my-today-meta`, `GET /shift/worker-performance/{workerId}` now **only ever return real, staffed shifts**. There is no more merged-in "virtual" projection for these — a worker literally cannot have a shift that isn't staffed, so there's nothing to preview here. If you had UI code branching on `is_virtual` for these specific endpoints, it can be simplified/removed (every row is real).

### 3.8 `/client/schedule-roster` — status field fixed

This endpoint's shape is unchanged, but a bug is fixed: previously an unstaffed row incorrectly showed `status: "upcoming"` and a fake `startTime`/`endTime` (`"08:00"`/`"16:00"`). Now:

- New field: **`isStaffed: boolean`** — check this first.
- `status: "unstaffed"` for unstaffed rows (was `"upcoming"`).
- `startTime` / `endTime`: `null` for unstaffed rows (was fake times).
- `shiftId: null` for unstaffed rows (was incorrectly set to the plan's own id).

**If your UI was checking `workerId === ''` or `workerName === 'Unassigned Specialist'` to detect an unstaffed row, switch to checking `isStaffed === false` instead** — it's now explicit and reliable.

### 3.9 Task (and Shift task) `photo_requirements` — two new optional fields

`POST /task/create-task`, `PATCH /task/update-task/{id}`, and every response that includes a task's `photo_requirements` (Task itself, Cleaning Plan's `rooms[].tasks[]`, and every Shift's `tasks[].photo_requirements`):

```jsonc
{
  "title": "Before cleaning",
  "description": "Take from directly above the sink",   // NEW, optional
  "reference_image_url": "https://.../example.jpg"      // NEW, optional
}
```

Both are optional (`null` if not set) — reserved for a future AI-assisted photo-verification feature. Purely additive: existing `photo_requirements` payloads with just `title` keep working unchanged. If you build a photo-requirement editor, you can add optional "description" and "reference image" inputs; if you show the checklist to a worker, you can display the description/reference image alongside the title when present.

**Same two fields also added to Additional Task's `photo_requirements`** (`POST /additional-task/create-additional-task`, `PATCH /additional-task/update-additional-task/{id}`, `PATCH /additional-task/approve-additional-task/{id}`, and every response including one) — identical shape, identical optionality.

---

## 4. New endpoints

### 4.1 `GET /shift/{planId}/{date}/eligible-workers` — worker picker for staffing

**Role:** manager only.
**Use this when building the "assign workers" screen** — call it to populate the worker list before the manager submits `assign-workers`.

**Query params (both required):**
- `start_time` — ISO datetime, the candidate shift's start
- `end_time` — ISO datetime, must be after `start_time`

**Example:**
```
GET /shift/6501.../2026-09-20/eligible-workers?start_time=2026-09-20T09:00:00Z&end_time=2026-09-20T13:00:00Z
```

**Response:**
```jsonc
{
  "success": true,
  "message": "Eligible workers retrieved successfully",
  "data": [
    {
      "worker": { "_id": "...", "name": "Jane Doe", "worker_type": "Employee", "working_days": ["monday","tuesday"], ... },
      "is_available": true,     // worker's own working_days vs this date's weekday
      "is_conflict": false,     // would double-book them against another staffed shift that day
      "conflict_reason": null,  // "double_booked" when is_conflict is true
      "conflicting_plan_id": null
    }
  ]
}
```

**Important nuances:**
- `is_available: true` when the worker hasn't configured `working_days` at all (empty array) — treated as "available every day" by default, not restricted. Don't read `is_available: false` as a hard block.
- **Neither flag blocks submission.** A manager can still assign an unavailable or conflicted worker — `is_conflict` only becomes a hard `409` at the actual `assign-workers` call, and only then does `force: true` matter. Render these as warning badges, not disabled checkboxes, unless you want to add your own UI-level restriction.
- Deleted/blocked/inactive workers are simply not in the list at all (not flagged).

### 4.2 `GET /shift/plan-roster` — manager-wide, plan-grouped roster (day/week/month)

**Role:** manager only.
**This is the system-wide equivalent of `GET /client/roster`** — same response shape, but across every client/plan instead of one client's own plans. Use this for a manager-facing "all clients' schedules" calendar view.

**Query params:**

| Param | Required | Notes |
|---|---|---|
| `view` | no | `day` \| `week` \| `month`, default `day` |
| `date` | no | anchors `day`/`week`, defaults to today |
| `year`, `month` | no | for `view=month` |
| `client` | no | filter to one client's plans |
| `location` | no | filter to one location's plans |
| `search` | no | case-insensitive plan-title search |
| `page`, `limit` | no | plans per page, default 10, max 50 |

**Response shape (identical structure to `GET /client/roster`'s `data`):**
```jsonc
{
  "view": "week",
  "start_date": "...", "end_date": "...",
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPage": 5, "total_shifts": 61 },
  "cleaning_plans": [
    {
      "plan_id": "...",
      "plan_title": "Weekly office deep clean",
      "location_name": "HQ Tower",
      "total_shifts_in_range": 3,
      "total_hours_in_range": 9.5,
      "shifts": [
        {
          "date": "2026-09-20",
          "shift_id": "...",            // null if unstaffed
          "is_virtual": false,          // true if unstaffed
          "status": "upcoming",         // "unstaffed" if is_virtual
          "start_time": "...",          // null if unstaffed
          "end_time": "...",            // null if unstaffed
          "duration_minutes": 240,
          "rooms": { "total": 4, "completed": 0 },
          "tasks": { "total": 9, "completed": 0 },
          "assigned_workers": [{ "worker_id": "...", "name": "...", "role": "Team leader" }]
        }
      ]
    }
  ]
}
```

If you already built a component for `GET /client/roster`, **it should work as-is for this endpoint too** — same shape, just a different data scope.

---

## 5. Notifications — type names changed (if your UI keys off notification `type`)

| Removed | Replacement |
|---|---|
| `CLEANING_PLAN_WORKER_ASSIGNED` | `SHIFT_WORKER_ASSIGNED` |
| `CLEANING_PLAN_WORKER_REMOVED` | `SHIFT_WORKER_REMOVED` |

Also: creating a Cleaning Plan no longer notifies any workers (there's no crew at creation time) — only the client is notified. Workers are now notified individually the moment they're actually staffed onto a shift (via the new `SHIFT_WORKER_ASSIGNED` type).

New type: `SHIFT_CANCELLED` — sent to both a shift's crew and the plan's client when a Task recurrence edit/delete cancels an already-staffed future shift (see §9).

---

## 6. Chat — plan group starts empty

A Cleaning Plan's group chat used to be seeded with the plan's default crew at creation. Now it's created with **just the client**, and gains a worker the first time they're staffed onto any shift under that plan (and keeps accumulating — a worker who rotates off a later shift is not automatically removed from the chat). If your UI shows "members" count right after creating a plan, expect it to start at 1 (client only), not the eventual crew size.

---

## 9. `PATCH /task/update-task/{id}` and `DELETE /task/delete-task/{id}` — can now cancel already-staffed future shifts, guarded by `force`

**Why:** a Task's `frequency_type` / `days_of_week` / `days_of_month` (or deleting/deactivating it) decides which future dates a plan is actually due on. If a manager had already staffed a future date under the *old* pattern (a real, crewed Shift exists for it) and the edit removes that date from the new pattern, that shift is now orphaned — nobody should silently keep a staffed shift the checklist no longer calls for, but it also can't just vanish out from under an already-notified crew/client.

**What happens now:**
- A recurrence-affecting edit (or a delete) is first checked against every already-staffed **future** (`upcoming`, dated after today) shift under that task's room's plan(s).
- If none are affected, or every affected shift has **no** assigned workers, the change applies immediately — unstaffed orphaned shifts are just cleaned up silently, no confirmation needed.
- If it would orphan a shift that **does** have assigned workers, the request is rejected with **`409 Conflict`** unless you pass `force: true`:
  ```jsonc
  // 409 response body
  {
    "success": false,
    "message": "This change removes one or more already-staffed future shifts from the schedule. Pass force=true to proceed — those shifts will be cancelled and the assigned crew/client notified.",
    "errorDetails": {
      "affected_shifts": [
        {
          "shift_id": "...",
          "plan_id": "...",
          "plan_title": "Weekly office deep clean",
          "date": "2026-09-28",
          "assigned_worker_ids": ["..."]
        }
      ]
    }
  }
  ```
- Show `affected_shifts` to the manager (dates + which plan) and let them confirm. On confirm, resend the same request with `force: true` (body field, or `?force=true` query param both work) — those shifts get `status: "cancelled"` (not deleted — they stay visible as cancelled, not silently gone) and both the previously-assigned workers and the client are notified (`SHIFT_CANCELLED`, see §5).
- Today's shift and anything already `in_progress`/`completed`/`cancelled` is never touched by this — only future, still-`upcoming` shifts are in scope.
- Still-valid future staffed shifts are left alone but have their `tasks[]`/`duration_minutes` resynced to the edited task, same as already happens for today's shift.

**Frontend action:** when calling task update/delete, handle `409` explicitly — show a confirmation dialog listing `affected_shifts`, and resubmit with `force: true` on confirm. Don't treat `409` here as a generic error toast.

---

## 10. Quick checklist for the frontend team

- [ ] Remove any "assign workers" / "start date" / "end date" inputs from the Cleaning Plan create/edit forms.
- [ ] Remove any "eligible workers" call against `/cleaning-plan/{id}/eligible-workers` — switch to `/shift/{planId}/{date}/eligible-workers`.
- [ ] Build (or update) the "assign workers" panel to collect `start_time` + `end_time` and send them on every `assign-workers` call, including reassignments.
- [ ] Everywhere a shift/schedule row is rendered: branch on `is_virtual` / `status === 'unstaffed'` and show a "Not yet staffed" state (no time, no avatars, maybe a "Schedule" button that opens the assign-workers panel).
- [ ] On `/client/schedule-roster`, switch any "is this staffed?" check to the new `isStaffed` field.
- [ ] If you show notification icons/labels keyed by `type`, add `SHIFT_WORKER_ASSIGNED`/`SHIFT_WORKER_REMOVED`/`SHIFT_CANCELLED` and drop the old `CLEANING_PLAN_WORKER_*` ones.
- [ ] If building a manager-wide schedule/calendar view, wire it to the new `GET /shift/plan-roster` instead of trying to assemble one from `/shift/roster` (which is worker-grouped, not plan-grouped).
- [ ] Handle `409` on task update/delete: show the `affected_shifts` list and resubmit with `force: true` on confirm (see §9).

---

## 11. Full reference

For complete request/response schemas of every endpoint mentioned here, see the live Swagger docs at `/api-docs` (or `/api-docs.json` for the raw OpenAPI spec) — all of the above is fully reflected there, including field-level descriptions.
