# Bulk Roster Assignment — Frontend Implementation Guide

**Audience:** frontend developer building the manager-facing roster screens.
**Backend status:** implemented and merged — 2 new endpoints, 1 extended endpoint.

## 1. What this feature is

Today, staffing a recurring Cleaning Plan means a manager assigns a worker **one date at a time**. This feature lets the manager instead:

1. Pick a Cleaning Plan, a date range (up to 60 days), and a worker.
2. The backend checks that worker's own declared **working days** and tells you which of the plan's upcoming, still-unstaffed dates match.
3. The manager reviews and confirms — the worker gets assigned to all matching dates in **one action**.
4. Whatever's left over (dates the worker isn't available for) stays open. The manager repeats the same flow with a different worker to cover the rest.
5. A roster list screen shows a count of "still needs staffing" per plan, so the manager doesn't have to open every plan to find gaps.

This is **additive** — the existing single-date "assign workers" screen/endpoint (`PATCH /shift/{planId}/{date}/assign-workers`) is untouched and still exists for one-off adjustments.

**Important mental model:** this is a **manual, repeatable action**, not a "set once and forget" auto-schedule. The manager runs it whenever they want to plan ahead (e.g. "staff next month"), and runs it again later for the next stretch. Nothing continues automatically after the chosen range ends.

---

## 2. Endpoint 1 — Preview: `GET /shift/{planId}/bulk-assign/preview`

Read-only. Call this first, every time, before showing the confirm screen. Nothing is written to the database.

**Auth:** manager only (Bearer token, same as every other `/shift/*` manager endpoint).

**Query params:**

| Param | Required | Type | Notes |
|---|---|---|---|
| `worker` | yes | ObjectId string | The worker being considered |
| `from` | yes | `YYYY-MM-DD` | Range start |
| `to` | yes | `YYYY-MM-DD` | Range end — **max 60 days after `from`**, inclusive |

**Example request:**
```
GET /shift/64f.../bulk-assign/preview?worker=64a...&from=2026-10-01&to=2026-10-31
```

**Response (`200`):**
```jsonc
{
  "success": true,
  "message": "Bulk assign preview retrieved successfully",
  "data": {
    "worker_id": "64a...",
    "worker_name": "John Doe",
    "range": { "from": "2026-10-01T00:00:00.000Z", "to": "2026-10-31T00:00:00.000Z" },

    // Due, unstaffed dates that match this worker's own availability —
    // these are exactly what gets assigned if you confirm with them as-is.
    "matching_dates": [
      { "date": "2026-10-01T00:00:00.000Z", "weekday": "thursday" },
      { "date": "2026-10-04T00:00:00.000Z", "weekday": "sunday" }
      // ...
    ],

    // Due, unstaffed dates this worker is NOT available for.
    // Still need a different worker — show these as a visible gap.
    "other_gap_dates": [
      { "date": "2026-10-03T00:00:00.000Z", "weekday": "saturday" }
    ],

    // Due dates in range that already have an active crew.
    // Never touched by this feature — just a count for context.
    "already_covered_count": 4
  }
}
```

**Error cases to handle:**
| Status | When | What to show |
|---|---|---|
| `400` | `to` is before `from` | "Invalid date range" |
| `400` | Range exceeds 60 days | "Please select 60 days or fewer" |
| `400` | `worker` is not a valid ID | Generic validation error |
| `400` | Worker not found / deleted / blocked | "This worker is not available" |
| `404` | Plan not found | Shouldn't happen from the UI, but handle gracefully |

---

## 3. Endpoint 2 — Confirm: `POST /shift/{planId}/bulk-assign`

Does the actual staffing. Call this after the manager reviews the preview and confirms.

**Auth:** manager only.

**Body:**
```jsonc
{
  "worker": "64a...",                 // same worker as the preview
  "role": "Normal worker",            // "Team leader" | "Co-leader" | "Normal worker"
  "dates": [                          // YYYY-MM-DD strings, max 60 entries
    "2026-10-01",
    "2026-10-04"
    // normally: matching_dates from the preview, minus anything the manager unchecked
  ],
  "start_time": "2026-10-01T09:00:00.000Z",  // only the TIME portion is used — applied to every date in `dates`
  "end_time": "2026-10-01T17:00:00.000Z",    // must be after start_time (time-of-day comparison)
  "force": false                              // optional — see conflicts below
}
```

**Notes on `start_time`/`end_time`:** send full ISO datetimes (any date works — the backend only reads the **hour/minute/second**), and that same time-of-day is applied to *every* date in `dates`. There is no per-date custom time in this flow — one shared time window per confirm action.

**Response (`200`):**
```jsonc
{
  "success": true,
  "message": "Bulk assignment completed",
  "data": {
    "assigned": ["2026-10-01", "2026-10-04"],              // newly staffed
    "skipped_already_staffed": ["2026-10-08"],             // already had a crew — untouched, not an error
    "ignored_due_to_conflict": [                            // worker double-booked elsewhere that day — skipped, not an error
      { "date": "2026-10-11", "reason": "One or more workers have a scheduling conflict..." }
    ],
    "failed": [],                                            // any other per-date failure (rare)
    "counts": {                                              // same totals as the array lengths, for convenience
      "assigned": 1,
      "skipped_already_staffed": 1,
      "ignored_due_to_conflict": 1,
      "failed": 0
    }
  }
}
```

**This call always returns `200`** even if some dates didn't go through — it's a per-date, best-effort result, not all-or-nothing. **Read the response body**, don't just check the HTTP status.

**Handling `ignored_due_to_conflict`:** this is the **normal, expected outcome** for a bulk action, not an error — by default the endpoint quietly staffs whoever's actually free and skips anyone double-booked elsewhere that day. **No follow-up action is required.** Just show it informationally in the result summary, e.g. *"3 dates skipped — worker already booked elsewhere."* Only if the manager explicitly wants to override that (rare — "yes, double-book them anyway") should you offer a secondary "Force assign anyway" action that resubmits the same request with `force: true`; that's optional polish, not required for v1.

**Error cases (request rejected outright, nothing written):**
| Status | When |
|---|---|
| `400` | `dates` empty or has more than 60 entries |
| `400` | `end_time` not after `start_time` |
| `400` | `worker` invalid, or `role` not one of the 3 allowed values |

---

## 4. Endpoint 3 (extended) — Roster list gap flag

`GET /shift/plan-roster` (and `GET /client/roster`, same shape) now includes one new field per plan:

```jsonc
{
  "cleaning_plans": [
    {
      "plan_id": "...",
      "plan_title": "Weekly office deep clean",
      "location_name": "HQ Tower",
      "total_shifts_in_range": 20,
      "unassigned_shift_count": 3,   // ← NEW
      "total_hours_in_range": 45.5,
      "shifts": [ /* ... unchanged ... */ ]
    }
  ]
}
```

`unassigned_shift_count` is scoped to whatever `view`/date window you already requested (day/week/month) — it's not a fixed lookahead. Use it to render a badge on each plan row in the roster list (see design below).

---

## 5. Screens & flow to build

### 5.1 Roster list view — gap badge
Wherever the manager currently sees the list of cleaning plans (the existing plan-roster screen), add a small badge next to any plan where `unassigned_shift_count > 0`:

> ⚠ **3 shifts need staffing**

Clicking it should take the manager into that plan's bulk-assign screen (5.2).

### 5.2 Bulk-assign screen (per plan)

**Step 1 — Setup**
- Cleaning Plan is already selected (came from the plan's roster row).
- Date range picker: two date inputs, "From" / "To". Enforce **max 60 days** client-side too (disable dates beyond that once "From" is picked), so the manager gets instant feedback instead of a server error.
- Worker picker: a dropdown/search of workers (reuse whatever worker-picker component already exists for the single-date assign screen).
- A "Preview" button — calls the preview endpoint.

**Step 2 — Review (after preview loads)**
Show three groups, visually distinct:

| Group | Source | Default state | Interaction |
|---|---|---|---|
| ✅ Will be assigned | `matching_dates` | Checked | Manager can **uncheck** individual dates they don't want this worker on |
| ⚠ Still needs a worker | `other_gap_dates` | — | Read-only info list, not part of this confirm. Just tells the manager what's left |
| ℹ Already covered | `already_covered_count` | — | Just a number, e.g. "4 dates already staffed" — no list needed |

Below the list, a **shared time window** input (start time / end time) and a **role** selector (Team leader / Co-leader / Normal worker), applied to every checked date.

**Step 3 — Confirm**
- "Assign N workers" button — sends only the **currently-checked** dates from the "Will be assigned" group as `dates`.
- On response, show a result summary using `counts` (all informational, none are error states the manager must resolve):
  - "✅ Assigned to N dates"
  - If `skipped_already_staffed.length`: "N dates were already staffed by someone else in the meantime" (the small race window between preview and confirm)
  - If `ignored_due_to_conflict.length`: "N dates skipped — worker already booked elsewhere that day" (optionally: a "Force assign anyway" link/button that resubmits with `force: true`, but this isn't required)
  - If `failed.length`: show the message per date

**Step 4 — Repeat for the gap**
After confirming, if `other_gap_dates` (from the original preview) is still non-empty, prompt: *"3 dates still need a worker — assign someone else?"* → takes the manager back to Step 1 with the same date range pre-filled, ready to pick a different worker. This is the manager-repeats-with-another-worker loop described in the requirements.

### 5.3 Suggested layout reference (not prescriptive — match your existing design system)

```
┌─ Bulk Assign — Weekly Office Deep Clean ─────────────────┐
│ From [2026-10-01]   To [2026-10-31]   Worker [John Doe ▾] │
│                                          [ Preview ]      │
├────────────────────────────────────────────────────────────┤
│ ✅ Will be assigned (26)                                   │
│  [x] Thu, Oct 1     [x] Sun, Oct 4     [x] Mon, Oct 5  ... │
│                                                              │
│ ⚠ Still needs a worker (4)                                  │
│  Sat, Oct 3   Sat, Oct 10   Sat, Oct 17   Sat, Oct 24      │
│                                                              │
│ ℹ 1 date already staffed                                    │
├────────────────────────────────────────────────────────────┤
│ Start [09:00]  End [17:00]  Role [Normal worker ▾]          │
│                                     [ Assign 26 shifts ]    │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Things to get right (backend behaviors you should not fight against)

- **Never assume `dates` you send were exactly what gets assigned.** Always read `assigned`/`skipped_already_staffed`/`ignored_due_to_conflict`/`failed` (or just `counts`) from the response and reconcile the UI against that, not against what you sent.
- **Don't try to "undo" a bulk assign from the frontend by re-running preview and diffing** — if the manager wants to change something after confirming, use the existing single-date assign-workers screen for that one date, same as today.
- **The 60-day/60-date cap is a hard server-side limit.** Client-side validation is for UX only — always handle the `400` gracefully regardless.
- **None of `already_covered_count`, `skipped_already_staffed`, or `ignored_due_to_conflict` are error states.** All three are expected, normal outcomes of "don't overwrite an existing assignment" / "don't double-book by default" — show them informationally, don't block the manager or demand action.

---

## 7. Quick reference — request/response types

```ts
// GET /shift/{planId}/bulk-assign/preview
interface BulkAssignPreviewResponse {
  worker_id: string;
  worker_name: string;
  range: { from: string; to: string };
  matching_dates: { date: string; weekday: string }[];
  other_gap_dates: { date: string; weekday: string }[];
  already_covered_count: number;
}

// POST /shift/{planId}/bulk-assign
interface BulkAssignRequest {
  worker: string;
  role: 'Team leader' | 'Co-leader' | 'Normal worker';
  dates: string[];          // YYYY-MM-DD, max 60
  start_time: string;       // ISO datetime, time-of-day only is used
  end_time: string;
  force?: boolean;
}

interface BulkAssignResponse {
  assigned: string[];
  skipped_already_staffed: string[];
  ignored_due_to_conflict: { date: string; reason: string }[];
  failed: { date: string; message: string }[];
  counts: {
    assigned: number;
    skipped_already_staffed: number;
    ignored_due_to_conflict: number;
    failed: number;
  };
}
```

Full OpenAPI schemas (`BulkAssignPreview`, `BulkAssignOutcome`) are also available at `/api-docs` / `/api-docs.json` if you want to generate typed clients.
