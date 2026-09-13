# Shift Management — How It Works

This explains the design behind Shifts: why they exist, how they get created, and how per-day worker reassignment stays conflict-safe. For request/response details, see `docs/SHIFT_APIS.md`. This builds directly on `docs/CLEANING_PLAN_ASSIGNMENT_DESIGN.md` — read that first if you haven't; it covers the recurrence engine and plan-level conflict checking that Shifts reuse.

## 1. Why Shifts exist

A `CleaningPlan` is a *definition*: "these rooms, these default workers, recurring on whatever schedule the rooms' tasks define." It can answer "does this conflict with that plan," computed live — but it has no way to represent "on 2026-02-11, this specific occurrence had these specific workers, and here's its status." That's what a **Shift** is: the concrete, single-day instance of a plan's recurring work.

Two needs drove this:
- **Per-day worker swaps.** A manager needs to replace one worker for a single day (someone's sick) without touching the recurring plan or affecting any other occurrence.
- **Per-occurrence state.** Eventually: check-in, completion, photos, status — all naturally per-day, not per-plan.

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

When a Shift materializes, it copies `rooms`, `duration_minutes`, and `assigned_workers` from the plan **at that instant** rather than storing a reference back to the plan and reading those fields live forever. This means a plan edit made *after* a shift already exists doesn't retroactively change that shift — which matters most once a shift has started or completed (you don't want a plan-level edit next month silently rewriting what actually happened on a past occurrence). Only occurrences that haven't materialized yet pick up plan changes automatically, because they're still virtual and computed fresh at read time.

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

`status` (`upcoming` / `in_progress` / `completed` / `cancelled`) exists on the Shift now as a foundation for the operational side (worker check-in, completion tracking) that naturally belongs per-occurrence rather than per-plan. There's currently no enforced transition workflow — any status can be set at any time — that's an intentional simplification left open for whenever check-in/completion flows are actually built on top of this.

## 8. Worker daily schedule

`GET /api/v1/shift/my-shifts?date=YYYY-MM-DD` lists the authenticated worker's assignments across plans for one UTC calendar date. It merges saved shifts with virtual occurrences from active, non-completed plans, preserving the read-only behavior above. Saved shifts remain visible when assigned to the worker even if the parent plan is now inactive or completed; cancelled shifts are included with their status.

Before generating virtual entries, the service checks for saved occurrences of every candidate plan, including shifts where the worker is no longer assigned. Any saved occurrence suppresses the plan's virtual fallback, so a manager's per-day worker removal cannot be undone by the default plan assignment. Results are sorted by start time, with plan ID breaking ties. Existing worker/date and plan/date indexes support the lookup; no model changes are required.
