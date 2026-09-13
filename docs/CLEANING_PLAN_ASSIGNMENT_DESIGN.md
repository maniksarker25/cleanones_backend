# Cleaning Plan & Worker Assignment — How It Works

This document explains the design behind Cleaning Plans and how workers get assigned to them without double-booking. It's the "why" and "how" behind the system; for exact request/response shapes see `docs/CLEANING_PLAN_APIS.md`.

## 1. The problem

A **Cleaning Plan** groups a set of **Rooms** at a **Location** that need to be cleaned, and a set of **Workers** assigned to do it. Two things make this harder than a simple booking system:

1. **Rooms recur on their own schedules.** A room isn't cleaned once — it has one or more **Tasks** (e.g. "vacuum," "deep clean") each with its own recurrence: daily, weekly (specific weekdays), or monthly (specific days-of-month). A single plan can therefore actually "happen" on many different calendar days, driven entirely by what tasks its rooms have.
2. **Workers can't be double-booked**, but "double-booked" has to account for that recurrence — two plans that each recur weekly only conflict if they share a weekday *and* their time windows overlap on that day.

The system needs to answer, reliably: *"Given everything else this worker is already assigned to, can they take this plan too — and if not, why?"*

## 2. The data model

```
Client
  └── Location
        └── Room
              └── Task (frequency_type: daily/weekly/monthly, days_of_week/days_of_month, duration_minutes)

CleaningPlan
  ├── client, location            (denormalized for querying)
  ├── rooms: [Room]                (which rooms this plan covers)
  ├── assigned_workers: [{worker, role, assigned_with_conflict}]
  ├── date_time                    (anchor date + time-of-day the plan starts)
  ├── end_date (optional)          (recurrence bound; omitted = indefinite)
  └── max_estimated_duration       (server-computed, see §3)
```

The important design decision here: **a Cleaning Plan does not have its own recurrence fields.** It doesn't need `frequency_type`/`days_of_week` of its own — its occurrence pattern is *derived* from the Tasks already defined on its rooms. `date_time` just gives the plan's anchor (the first possible date, and the time-of-day it runs); which calendar days it actually recurs on comes from unioning the recurrence of every active Task under `rooms`.

This means: a plan with rooms that have no active Tasks is treated as never occurring, and never conflicts with anything. That's a deliberate consequence of tying occurrence to the underlying room work, not an oversight.

## 3. Duration: a conservative estimate, not a precise one

`max_estimated_duration` is computed automatically (never accepted from the client) whenever a plan's `rooms` change: it's the **sum of `duration_minutes`** across every active Task on those rooms.

This is intentionally a **worst-case upper bound**, not a day-accurate figure. A room might have a weekly task (30 min) and a monthly task (90 min) — on most days only the weekly one applies, but `max_estimated_duration` assumes both could land on the same day (120 min). Why accept that inaccuracy?

- Computing the *real* duration would require knowing which specific calendar day is being checked, which turns every conflict check into a per-date calculation instead of a one-time number.
- For a conflict check, being wrong in the "safe" direction (occasionally warning about a conflict that wouldn't really have overlapped) is far better than being wrong in the unsafe direction (missing a real double-booking). A conservative estimate can never cause a false "available."

If day-accurate duration is ever needed for reporting/display, it can be added later as a separate, independent calculation — it doesn't have to touch the conflict-checking logic at all.

## 4. Detecting conflicts

For two plans (each with its own set of task recurrence patterns and its own time window) to conflict for a given worker, three things all have to be true:

1. The worker is assigned to both.
2. Their **time windows overlap** on the same day (`date_time`'s time-of-day + `max_estimated_duration`, compared as clock time — not calendar date).
3. They actually **share at least one calendar day** where both plans occur, given their recurrence patterns.

Point 3 is the interesting part, because naively projecting "does this ever happen on the same day" out to infinity isn't possible for open-ended recurring plans. The system uses two strategies:

- **Same recurrence type → direct comparison, no date math.** Two weekly patterns conflict if their `days_of_week` sets intersect (and their active date ranges overlap at all — a "every Monday" pattern that ran only in March can't conflict with one that only started in July, even though both say "Monday"). Two monthly patterns work the same way on `days_of_month`. A daily pattern, being active every day, reduces straight to the time-window check. This is instant — no simulation needed.
- **Different recurrence types (e.g. weekly vs. monthly) → bounded calendar projection.** There's no shortcut here since a weekday and a day-of-month don't line up on a fixed cycle, so the system actually walks forward day-by-day and checks whether both patterns land on the same date. This is capped at 90 days (or `end_date`, whichever is sooner) — recurrence is never projected to infinity, since that's both impossible and pointless for a scheduling decision that only matters in the near-to-mid term.

This hybrid keeps the common cases (same-type recurrence, by far the most frequent) cheap and exact, and only pays the cost of real date simulation for the mixed cases, bounded to a sane horizon.

## 5. Eligibility vs. conflict — two different kinds of "no"

These are kept strictly separate, because they call for different responses:

| | Eligibility (deleted / blocked / inactive account) | Conflict (double-booked) |
|---|---|---|
| What it means | The worker literally cannot work — the account is gone or disabled | The worker *could* work, but is already booked elsewhere at an overlapping time |
| Can a manager override it? | **Never.** This isn't a judgment call, it's a data-integrity fact. | **Yes**, via `force=true` — it's a business decision a human is entitled to make (e.g. a short plan, a manager decides the overlap is acceptable). |
| How it's surfaced | Ineligible workers are **excluded from the eligible-workers list entirely** — they don't even show up as "conflicted" | Shown in the list as `is_conflict: true` with a `conflict_reason`, and rejected with `409` on assignment unless overridden |

## 6. The assignment flow

1. **Manager views a plan** and calls `GET /:id/eligible-workers`. The system:
   - Loads the plan, derives its occurrence patterns + duration (§2–3).
   - Filters out every ineligible worker up front.
   - For each remaining worker, checks their other active plan assignments for a conflict (§4) and returns `is_conflict` + `conflict_reason` per worker.
2. **Manager picks workers and assigns them** via `PATCH /:id/assign-workers`. The exact same conflict-check function runs again (so the preview and the enforcement can never drift apart):
   - Any ineligible worker in the submission → hard `400`, no override possible.
   - Any conflicted worker, without `force` → `409`, listing exactly which workers conflict and with which other plan.
   - With `force: true` → the assignment proceeds, and each conflicted entry is stored with `assigned_with_conflict: true`.
3. **The audit trail.** `assigned_with_conflict: true` on an assignment is a permanent, visible marker that a manager knowingly overrode a scheduling warning — not a silent bypass. If double-bookings later cause a real problem, it's traceable back to a deliberate decision rather than indistinguishable from a normal assignment.

## 7. Why `assigned_workers` and `force` also work on create/update directly

The dedicated `/assign-workers` endpoint exists for the common flow (create the plan, then assign workers as a follow-up step), but a manager can also submit `assigned_workers` directly when creating or updating a plan in one call. Both paths funnel through the identical conflict-check and duration-computation logic — there's exactly one implementation of "is this assignment allowed," reused everywhere it's needed, so behavior can't silently diverge between the two entry points.

## 8. Known trade-offs, by design

- **Conservative duration, not day-accurate.** See §3 — accepted deliberately, safe by construction.
- **Same-type fast path is an approximation for very short overlap windows.** E.g. a 2-day overlap between two "every Monday" plans might not actually contain a Monday, but gets flagged as if it does. This only matters for unusually short-lived plans, and again errs toward over-flagging rather than missing a real conflict — acceptable for a human-reviewed warning with an override.
- **90-day projection cap for mixed-type comparisons.** An indefinite weekly-vs-monthly pair is only checked for conflicts within the next 90 days at assignment time, not forever. Setting `end_date` on a plan gives more precise control over this window when it matters.
