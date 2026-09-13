# Shift Management — How It Works

This explains the design behind Shifts: why they exist, how they get created, and how per-day worker reassignment stays conflict-safe. For request/response details, see `docs/SHIFT_APIS.md`. This builds directly on `docs/CLEANING_PLAN_ASSIGNMENT_DESIGN.md` — read that first if you haven't; it covers the recurrence engine and plan-level conflict checking that Shifts reuse.

## 1. Why Shifts exist

A `CleaningPlan` is a *definition*: "these rooms, these default workers, recurring on whatever schedule the rooms' tasks define." It can answer "does this conflict with that plan," computed live — but it has no way to represent "on 2026-02-11, this specific occurrence had these specific workers, and here's its status." That's what a **Shift** is: the concrete, single-day instance of a plan's recurring work.

Two needs drove this:
- **Per-day worker swaps.** A manager needs to replace one worker for a single day (someone's sick) without touching the recurring plan or affecting any other occurrence.
- **Per-occurrence state.** Photo submissions, task completion, and status — all naturally per-day, not per-plan (see §9–10).

## 2. Materialize lazily, not exhaustively

The first design question was: do we pre-generate every future occurrence as a database row? **No** — and this was a deliberate choice, not an oversight:

- An indefinitely recurring plan (no `end_date`) has infinitely many future occurrences — there's no finite "all of them" to generate.
- Any plan edit after the fact (rooms, workers, timing) would leave already-generated future rows stale, requiring a sync step to find and fix them.

Instead, Shifts follow a **read-virtual, write-materializes** rule:

- **Reading** a future (or any) date that has no Shift row yet returns a **virtual** result — computed on the fly from the plan's *current* state, tagged `is_virtual: true`, nothing written to the database. This is exactly the same recurrence engine used for plan-level conflict checking, just aimed at "what does this specific date look like" instead of "do these two patterns ever collide."
- **Writing** to a date (reassigning a worker, or a status update) **materializes** it first — creates a real `Shift` document, snapshotting the plan's rooms/duration/default-workers *at that moment* — then applies the change on top.
- A **daily cron job** also materializes today's occurrence for every active plan, so that by the time a worker needs to check in, there's always a real row for "today," even if no manager ever touched it.

This means: far-future dates cost nothing to query and are always in sync with the live plan (since they're computed fresh every time), while the near-term/actionable dates that people actually interact with become durable records.

## 3. The idempotency guarantee: unique `(cleaning_plan, date)` index

Two different things can trigger materialization for the same plan+date: a manager editing that specific day, and the daily cron reaching that date. Both call the exact same function — `getOrCreateShift(planId, date)` — and that function is the **only** place a `Shift` is ever created. It:

1. Looks for an existing row for `(cleaning_plan, date)` — returns it if found.
2. Otherwise builds a fresh snapshot from the plan and inserts it.
3. If the insert fails with a MongoDB duplicate-key error (because something else — the cron, or a concurrent request — inserted the same `(cleaning_plan, date)` a moment earlier), it doesn't treat that as a failure: it re-fetches the now-existing row and returns that instead.

The `{cleaning_plan: 1, date: 1}` **unique index** is what makes this safe under real concurrency — without it, "check then create" has a race window where two callers could both pass the check and both try to insert. With the unique index, the database itself guarantees only one row ever exists, and the second writer's error is the signal to fall back to reading what the first writer created. This is what lets "manager edits a future day" and "cron reaches that day later" cooperate correctly regardless of which happens first — exactly the scenario that prompted this design.

## 4. Snapshotting, not live-referencing

When a Shift materializes, it copies `rooms`, `tasks`, `duration_minutes`, and `assigned_workers` from the plan **at that instant** rather than storing a reference back to the plan/room/task/worker documents and reading those fields live forever. This means an edit made *after* a shift already exists — renaming a room, changing a task's required photos, correcting a worker's name — doesn't retroactively change that shift. This matters most once a shift has started or completed: you don't want a plan-level edit next month silently rewriting what a worker was actually asked to do, or who actually did it, on a past occurrence. Only occurrences that haven't materialized yet pick up plan/room/task/worker changes automatically, because they're still virtual and computed fresh at read time.

`room`/`task`/`worker` ObjectId fields are still kept inside each snapshot entry, but purely for **traceability** (so an audit can trace a shift's task instance back to the Task it came from) — nothing in the system ever re-derives a shift's displayed content by populating them. The frozen `name`/`room_type`/`photo_requirements` fields are always authoritative for what that shift actually shows.

This same reasoning extends to `assigned_workers`: each entry snapshots the worker's `name` at assignment time (not just their `worker` ObjectId), so a later profile edit or deactivation can't retroactively change who a historical shift says worked that day.

## 5. Per-shift worker reassignment and conflict checking

Reassigning a worker for one occurrence is deliberately **simpler** than the plan-level conflict check, because the hard part — resolving recurrence into a concrete date — is already done. A shift is one fixed date and one fixed time window, so the conflict question reduces to: *does this worker have anything else at an overlapping time on this exact date?*

Two sources are checked, because the worker's "something else" could be either kind of record:

1. **Other materialized Shifts** for this worker on this date. This is checked first and treated as authoritative — if a shift exists, whatever it says about assigned workers reflects any override already applied to it, which is more accurate than trusting the parent plan's default.
2. **Other active CleaningPlans** the worker is assigned to that occur on this date but haven't been materialized into a Shift yet for it. This uses the same recurrence pattern check as plan-level conflict detection, just evaluated against one concrete date instead of projected across a range.

A plan already covered by a materialized shift found in step 1 is excluded from step 2 — otherwise the same real conflict could be reported twice, once from stale plan-default data and once from the (correct) shift override.

Eligibility rules carry over unchanged from the plan level: deleted/blocked/inactive workers are hard-rejected, never overridable; a genuine scheduling conflict can be pushed through with `force: true`, and the resulting entry is marked `assigned_with_conflict: true` for the same audit reasons described in the plan-level design doc.

## 6. `is_worker_overridden`

Every shift starts with `assigned_workers` equal to the plan's default (auto-inherited — no action needed for the common case) and `is_worker_overridden: false`. The moment a manager reassigns workers for that specific day, it flips to `true` — a permanent marker that this occurrence's staffing diverges from the plan's default, distinct from `assigned_with_conflict` (which marks *why* a specific worker entry was allowed through despite a conflict). Future occurrences of the same plan are unaffected; each shift's override status is independent.

## 7. Status

`status` (`upcoming` / `in_progress` / `completed` / `cancelled`) exists on the Shift as a foundation for the operational side that naturally belongs per-occurrence rather than per-plan. There's currently no enforced transition workflow — any status can be set at any time — that's an intentional simplification left open for whenever a stricter check-in workflow is needed.

## 8. Tasks: from recurring template to per-occurrence instance

A `Task` (attached to a Room) declares *what* recurs and *what photos are required*, but it's a single shared document across every occurrence it produces — every Monday's cleaning of that room is the same `Task` row. It therefore cannot hold per-day state like "was the before-photo uploaded this Monday." So `Task.photo_requirements` is deliberately a **template only** — just `{ title }`, nothing about upload state.

When a Shift materializes, each active Task on its rooms becomes its own entry in `Shift.tasks[]` — a fresh, independent instance for that specific day: the task's `name`/`duration_minutes`/`is_photo_required` are snapshotted, and `photo_requirements` is rebuilt from the Task's title list with `photo_url: null, is_uploaded: false` for every title, regardless of what any other day's shift for the same Task looked like. Each `IShiftTask` also snapshots its `room` directly (not just `task`), so a shift's tasks can be grouped/filtered by room without a join back through the Task collection.

## 9. Photo submission and automatic completion

A worker uploads a photo via `PATCH /shift/:planId/:date/tasks/:taskId/photo` with `{ title, photo_url }` (the file itself is uploaded separately through the generic file-upload module first; this endpoint just records the resulting URL). The call:

1. Materializes the shift if it's still virtual (via `getOrCreateShift` — the same single write path as every other shift mutation).
2. Verifies the calling worker is actually in that shift's `assigned_workers` — a worker can only submit photos for a shift they're assigned to.
3. Finds the matching `photo_requirements` entry by exact `title` match within that task instance; an unrecognized title is a `400`, not silently ignored.
4. Writes `photo_url`/`is_uploaded` atomically via a MongoDB array-filter update (`tasks.$[t].photo_requirements.$[p]`) — targeted at the exact nested entry, so concurrent uploads to *different* photo slots on the same shift never clobber each other.
5. Re-reads the task instance and recomputes `is_completed`: `true` once every `photo_requirements` entry has `is_uploaded: true` (or immediately, if `is_photo_required` is `false` — nothing is gating it). `completed_at` is set the moment it flips to `true`.

Separately, each task instance also carries its own `status` (`UPCOMING` / `IN_PROGRESS` / `COMPLETED`), always starting at `UPCOMING` when materialized — independent of `is_completed`. There is no endpoint or automatic logic transitioning it yet; it's a placeholder field for a workflow to be defined later.

**There is no manual "mark complete" action and no manager approval step.** This was a deliberate simplification: the team works together on a shift without needing per-person task accounting (see §10), and requiring a manager to individually approve every task on every shift would add review overhead without a corresponding business need right now. If review/approval is needed later, it can be layered on top of this `tasks[]` structure (e.g. an `is_approved` flag) without changing how photos are recorded.

## 10. No per-task worker assignment

`IShiftTask` intentionally has no `assigned_to` field. The whole team listed in a shift's `assigned_workers` works the shift together — any of them can upload a photo for any task on any room in that shift. This was a deliberate simplification over per-task/per-room worker assignment (e.g. "worker X only handles Room A"): the latter would need its own conflict/validation rules and isn't needed unless a team actually splits up by room, which isn't the current operating model. If that need arises, an optional `assigned_to: ObjectId` could be added to `IShiftTask` without disturbing anything else here.

## 11. Worker daily schedule

`GET /api/v1/shift/my-shifts?date=YYYY-MM-DD` lists the authenticated worker's assignments across plans for one UTC calendar date. It merges saved shifts with virtual occurrences from active, non-completed plans, preserving the read-only behavior above. Saved shifts remain visible when assigned to the worker even if the parent plan is now inactive or completed; cancelled shifts are included with their status.

Before generating virtual entries, the service checks for saved occurrences of every candidate plan, including shifts where the worker is no longer assigned. Any saved occurrence suppresses the plan's virtual fallback, so a manager's per-day worker removal cannot be undone by the default plan assignment. Results are sorted by start time, with plan ID breaking ties. Existing worker/date and plan/date indexes support the lookup; no model changes are required.

## 12. One snapshot builder, reused everywhere

A shift's content (`location`, `rooms`, `tasks`, `assigned_workers`, `duration_minutes`, and the recurrence patterns used to decide whether a plan occurs on a given date) is built in exactly one place — `buildShiftSnapshot(plan)` — from a single batched fetch (Location, Rooms, active Tasks, Workers, each queried once in parallel rather than the patterns and duration being computed via separate redundant queries as in an earlier version of this design). Every call site that needs to know "what would this plan's occurrence look like" — `getOrCreateShift`, the single-date and range preview reads, and the worker's `my-shifts` virtual fallback — calls this same function. This is what guarantees a virtual preview and the shift that eventually materializes from it are always built identically; there's no second implementation that could quietly drift out of sync.

## 13. Check-in / check-out and the 50m geofence

Each shift snapshots its plan's `Location` the same way it snapshots rooms/tasks/workers — `{ location: ObjectId, name, coordinates }`, frozen at materialization time. This is what a worker's check-in/check-out is validated against: not the live Location document, but the shift's own copy, for the same reason as everything else in §4 (a Location's address or GPS point changing later shouldn't retroactively alter what a past check-in was validated against).

**Check-in/check-out is the one deliberate exception to "writes materialize a virtual shift."** Unlike `assign-workers`, `status`, and the photo upload — which all call `getOrCreateShift` and will happily turn a virtual future occurrence into a real one — check-in/check-out only ever look up an **already-materialized** `Shift` and return `404` if none exists. This is intentional: there is no scenario where checking into a shift that hasn't happened yet makes sense, and by the time a worker is physically on-site to check in, the daily cron has already materialized today's occurrence. Letting check-in silently materialize a shift would also be the wrong trigger for it — the cron and manager edits should own that decision, not a location ping.

**No time-window restriction was requested** — a worker can check in or out at any time on the shift's date; only physical proximity is enforced, not schedule adherence. This keeps the feature to exactly what was asked (geofencing) without inventing an unrequested "late/early" business rule.

**Distance is computed with the Haversine formula** between the worker's submitted `[longitude, latitude]` and the shift's frozen `location.coordinates`, compared against a **50 meter** threshold. If the shift's Location has no GPS point configured at all (`coordinates: null`), check-in **fails closed** with a `400` rather than silently skipping the geofence check — a misconfigured Location should never become a way to bypass the requirement. On rejection, the actual computed distance is included in the error message so the client can show the worker how far away they are.

**Check-in state lives directly on the `assigned_workers` entry** (`check_in_at`, `check_in_coordinates`, `check_out_at`, `check_out_coordinates`) rather than as a separate record, because it's inherently per-worker-per-shift data — the same place that already snapshots who was assigned to work that day. Coordinates are stored (not just the timestamp) as evidence of *where* the check-in actually happened, in case it's ever disputed. A worker can only check in once and check out once per shift (both guarded server-side); check-out additionally requires a prior check-in.
