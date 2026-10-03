# Cleaning Plan Task Selection — Frontend Implementation Guide

**Audience:** frontend developer building/editing the Cleaning Plan create & edit screens.
**Backend status:** implemented, **not yet deployed**. A one-off DB migration must run before this goes live (see §8 — this does not block frontend work, but don't ship the frontend change before you've confirmed with backend that the migration has run).

---

## 1. What changed and why

**Before:** a Cleaning Plan only stored `rooms` (room IDs). When a shift was generated from a plan, the backend pulled in **every active task** under those rooms automatically. There was no way to pick a subset.

**Now:** a Cleaning Plan also stores its own `tasks` field — the specific Task IDs selected for that plan. Only those tasks are pulled into shifts generated from the plan.

**Why:** this unlocks splitting one room's work across multiple plans. Example — Room 101 has tasks `[Vacuum, Dust, Clean Bathroom, Empty Trash]`:

- Plan A: Room 101 → tasks `[Vacuum, Dust]` → morning shift → Worker X
- Plan B: Room 101 → tasks `[Clean Bathroom, Empty Trash]` → afternoon shift → Worker Y

Same room, two plans, two different task subsets, two different crews/time windows. Previously this was impossible — a room's full task list always went into whichever single plan contained it.

**Core rule to bake into the UI:** every task selected on a plan must belong to a room that is also selected on that same plan. The backend enforces this (400 error if violated — see §7), but the UI should make it structurally impossible to violate in the first place (see §9).

---

## 2. Endpoints affected

| Method | Path | What changed |
| --- | --- | --- |
| POST | `/api/v1/cleaning-plan/create-cleaning-plan` | New optional `tasks` field in request body |
| PATCH | `/api/v1/cleaning-plan/update-cleaning-plan/:id` | New optional `tasks` field in request body; new auto-prune behavior |
| GET | `/api/v1/cleaning-plan/all-cleaning-plans` | Response: `total_tasks`/`total_task` now count only the plan's selected tasks (not every task in its rooms) |
| GET | `/api/v1/cleaning-plan/single-cleaning-plan/:id` | Response: new `tasks` field; `rooms[].tasks` now shows only this plan's selected tasks per room (not every active task in the room); `total_tasks`/`total_task_duration` recalculated accordingly |
| GET | `/api/v1/task/all-tasks/:roomId` | **Not changed**, but now the primary data source for the new task-picker UI (see §3) |

No endpoint was removed or renamed. No response envelope changed (`{ success, message, data }` as always).

---

## 3. New UI building block: per-room task picker

There's no new endpoint for this — use the existing one:

```
GET /api/v1/task/all-tasks/:roomId
```

(manager-only, `Authorization: Bearer <manager-token>`). Supports the usual list query params (`page`, `limit`, `searchTerm`, `sort`).

**Response — `200 OK`**

```jsonc
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": {
    "meta": { "page": 1, "limit": 10, "total": 4, "totalPage": 1 },
    "result": [
      {
        "_id": "65a1f0000000000000000201",
        "name": "Vacuum carpet",
        "room": { "_id": "65a1f0000000000000000101", "name": "Reception", "room_type": "office", "cleaning_type": "standard", "floor": 1 },
        "frequency_type": "daily",
        "days_of_week": [],
        "days_of_month": [],
        "duration_minutes": 20,
        "is_photo_required": true,
        "required_photo_count": 1,
        "photo_requirements": [
          { "title": "Before", "description": null, "reference_image_url": null },
          { "title": "After", "description": null, "reference_image_url": null }
        ],
        "is_active": true,
        "createdAt": "2026-01-05T09:00:00.000Z",
        "updatedAt": "2026-01-05T09:00:00.000Z"
      }
    ]
  }
}
```

Call this once per room the manager has selected on the plan, to populate a "select tasks for this room" checklist. Only `is_active: true` tasks should be selectable (inactive ones can still be returned by this endpoint depending on query — filter them out client-side if needed, or rely on the fact the backend will reject a non-matching selection anyway).

---

## 4. `POST /api/v1/cleaning-plan/create-cleaning-plan`

**Request body** — new field in bold:

```jsonc
{
  "title": "Central Office — Reception and Meeting Room",
  "description": "Recurring cleaning of Reception and Meeting Room.",
  "client": "65a1f0000000000000000001",
  "location": "65a1f0000000000000000002",
  "rooms": ["65a1f0000000000000000101", "65a1f0000000000000000102"],
  "tasks": ["65a1f0000000000000000201", "65a1f0000000000000000202"], // NEW — optional
  "note": "Sample cleaning plan",
  "status": "active"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `tasks` | `string[]` (ObjectIds) | no (defaults to `[]`) | Every task ID's own `room` must be one of the IDs in `rooms` in this same request. If omitted or `[]`, the plan starts with **no tasks selected** — it won't generate any shift content until edited. |

`max_estimated_duration` is still server-computed and still ignored if sent by the client — but it's now computed from `tasks`, not from every task in `rooms`.

**Response — `201 Created`** — same shape as before, with `tasks` now present on the returned document:

```jsonc
{
  "success": true,
  "message": "Cleaning plan created successfully",
  "data": {
    "_id": "65a1f0000000000000000999",
    "title": "Central Office — Reception and Meeting Room",
    "rooms": ["65a1f0000000000000000101", "65a1f0000000000000000102"],
    "tasks": ["65a1f0000000000000000201", "65a1f0000000000000000202"],
    "max_estimated_duration": 40,
    "status": "active",
    "...": "rest of the plan document, unchanged"
  }
}
```

---

## 5. `PATCH /api/v1/cleaning-plan/update-cleaning-plan/:id`

**Request body** — `tasks` is optional, independent of `rooms`:

```jsonc
{
  "rooms": ["65a1f0000000000000000101"],
  "tasks": ["65a1f0000000000000000201"]
}
```

**Behavior to understand (important for the edit-plan screen):**

- If you send `tasks` in the payload, it **fully replaces** the plan's task selection (not a merge/diff) — same convention as every other array field in this API. Always send the complete desired list.
- If you send `rooms` **without** `tasks` in the same request, and a room that had tasks selected is removed from `rooms`, the backend **automatically drops** those now-orphaned tasks from the plan's `tasks` list. You don't need to compute this yourself — but the UI should reflect it: after a room-only update, re-fetch the plan (or read `tasks` off the response) rather than assuming the previous `tasks` list is still accurate.
- If you send both `rooms` and `tasks` together, the backend validates `tasks` against the **new** `rooms` list (not the old one) — so a single "remove room + reselect tasks" edit in one request works correctly.
- `max_estimated_duration` is recomputed whenever either `rooms` or `tasks` is present in the request.

**Response** — same shape, `tasks` reflects the final (possibly auto-pruned) state:

```jsonc
{
  "success": true,
  "message": "Cleaning plan updated successfully",
  "data": {
    "_id": "65a1f0000000000000000999",
    "rooms": ["65a1f0000000000000000101"],
    "tasks": ["65a1f0000000000000000201"],
    "max_estimated_duration": 20,
    "...": "rest of the plan document"
  }
}
```

---

## 6. `GET /api/v1/cleaning-plan/all-cleaning-plans` (list view)

No field was removed or renamed. Behavior change only:

- `total_tasks` / `total_task` (both present, same value, legacy duplicate field) now count **only the plan's selected tasks**, not every active task across its rooms. If two plans share a room with different task subsets, each now reports its own correct count instead of both showing the room's full task count.

No UI change required here beyond expecting these numbers to possibly be smaller than before for existing plans that get edited down to a subset.

---

## 7. `GET /api/v1/cleaning-plan/single-cleaning-plan/:id` (detail view)

Two changes:

1. **New top-level field**: `tasks: string[]` — the plan's selected task IDs (same as what you'd send back on an update).
2. **`rooms[].tasks` is now filtered**: each room object's nested `tasks` array (full Task documents, used for the detail page's per-room task list) now shows only the tasks that are **both** active **and** selected on this plan — not every active task the room has. `rooms[].total_task` / `rooms[].total_duration` are computed from this filtered list.

```jsonc
{
  "success": true,
  "message": "Cleaning plan retrieved successfully",
  "data": {
    "_id": "65a1f0000000000000000999",
    "title": "Central Office — Reception and Meeting Room",
    "tasks": ["65a1f0000000000000000201"], // NEW
    "rooms": [
      {
        "_id": "65a1f0000000000000000101",
        "name": "Reception",
        "room_type": "office",
        "tasks": [
          // Only tasks in this room AND in the plan's `tasks` array above —
          // "Dust", "Clean Bathroom", "Empty Trash" etc. that belong to this
          // room but were NOT selected on this plan will NOT appear here,
          // even though they exist and are active.
          { "_id": "65a1f0000000000000000201", "name": "Vacuum carpet", "duration_minutes": 20, "...": "full Task doc" }
        ],
        "total_task": 1,
        "total_duration": 20
      }
    ],
    "total_rooms": 1,
    "total_tasks": 1,
    "total_task_duration": 20,
    "max_estimated_duration": 20,
    "...": "rest of the plan document, unchanged"
  }
}
```

**If your current detail page renders "all tasks in this room" from `rooms[].tasks`,** that's exactly the field that changed meaning — it's now "selected tasks in this room for THIS plan." Re-verify any copy/empty-state text that assumed it showed every room task.

---

## 8. Error responses to handle

All are `{ success: false, message, errorDetails }`, same envelope as every other error in this API.

| Status | `message` | When | Suggested UI handling |
| --- | --- | --- | --- |
| `400` | `"One or more selected tasks do not exist"` | A task ID in `tasks` doesn't exist in the DB (e.g. stale cache, deleted task) | Generic "selection is out of date, please refresh and reselect" — refetch room tasks and let the manager re-pick |
| `400` | `"One or more selected tasks do not belong to this plan's selected rooms"` | A task's room isn't in the `rooms` list of the same request | This should be **structurally prevented by the UI** (see §9) — if it still happens, it's a bug in the picker logic, not a normal user error |
| `400` | `"<value> is not a valid ID!"` | A malformed string was sent in `tasks` (not a valid ObjectId) | Shouldn't happen if task IDs come straight from the picker's own API response — treat as a dev bug if seen |

---

## 9. UI / design changes checklist

- [ ] **Create-plan form:** after the manager selects `rooms`, show a per-room, collapsible task checklist (one `GET /task/all-tasks/:roomId` call per selected room). Default state: open question for product — either "nothing selected" or "everything pre-checked" (pre-checking everything most closely matches the old behavior and is probably the safer default for existing users).
- [ ] **Keep the task checklist in sync with room selection**: if a room is removed from the `rooms` picker before submit, immediately drop its tasks from the pending `tasks` selection client-side too — don't rely on the backend's auto-prune for a room removed *before* the first save, since that prune only happens on an *update* to an *existing* plan, not during initial creation state-building in the UI.
- [ ] **Edit-plan form:** load the plan's current `tasks` (from the detail endpoint, §7) and pre-check them per room. When a room is removed during editing, drop its tasks from the local selection state the same way, so the submitted payload is already consistent — don't depend solely on backend auto-prune, since that's a safety net, not a substitute for correct UI state.
- [ ] **Allow the same room to be added to more than one plan.** If there's currently any client-side restriction (e.g. hiding rooms "already used in another plan" from the room picker), remove it — that's exactly the scenario this feature is meant to enable.
- [ ] **Submit `tasks` as the full list every time**, same as `rooms`, `assigned_workers`, etc. — never a diff.
- [ ] **Detail/view page:** re-check anywhere `rooms[].tasks` or `total_task`/`total_tasks`/`total_task_duration`/`max_estimated_duration` is displayed or used for client-side math — the numbers now reflect only selected tasks (see §6–§7).
- [ ] **Empty-selection state:** if a plan is saved with `tasks: []` (no tasks picked for any room), it generates no shift content at all. Consider a form-level warning ("this plan has no tasks selected and won't produce any shifts") rather than silently allowing an empty-but-"active" plan.

---

## 10. Rollout note (coordinate with backend before shipping)

Existing cleaning plans in the database don't have a `tasks` field yet. Backend will run a one-off migration that backfills `tasks` = "every active task in the plan's rooms" for every existing plan, so **no existing plan's shifts change** until a manager actually edits it. Confirm with backend that:

1. The migration has been run in the target environment, and
2. The new backend code (this feature) is deployed

...before shipping the frontend change that starts sending/reading `tasks`. Sending `tasks` against an un-migrated backend is safe (the field just gets set), but reading `tasks`/`rooms[].tasks` from the detail/list endpoints before the backend code deploys will show the old shape (no `tasks` field, `rooms[].tasks` = all room tasks) — so coordinate the deploy order with backend rather than guessing.
