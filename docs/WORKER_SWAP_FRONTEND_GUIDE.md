# Worker Swap & Pay Settlement — Frontend Implementation Guide

**Audience:** frontend developer working on the manager crew-editing screen and the worker check-in/check-out flow.
**Backend status:** implemented and merged. **No new endpoints, no payload/response shape changes** — both affected endpoints keep their existing request and response format. What changed is *behavior*: what used to be rejected is now allowed, and one error message is new. Read this before touching the UI, because the old assumptions baked into the current screens are no longer correct.

---

## 1. What changed and why

Managers need to swap a worker out mid-shift — a no-show gets replaced, or someone falls ill and leaves partway through. Two things had to change to support that safely:

1. **Assigning workers no longer wipes out check-in data.** Editing the crew used to fully replace the worker list — if you called it after a worker had checked in, their check-in timestamp silently vanished. Now it merges: workers already on the shift keep their check-in/check-out state untouched.
2. **Pay is now settled once, at the end, not per individual checkout.** Since a shift's crew size can now change mid-shift, paying each worker immediately at their own checkout could lock in the wrong split. Instead, the shift's total duration is divided evenly across everyone who actually checked in, and everyone gets paid together the moment the **last** person checks out.

---

## 2. Endpoint — Assign / Edit / Swap Workers

`PATCH /shift/{planId}/{date}/assign-workers`

**Nothing changed in the request or response shape.** Same payload, same response.

```jsonc
// Request body — unchanged
{
  "assigned_workers": [
    { "worker": "64a...", "role": "Team leader" },
    { "worker": "64b...", "role": "Normal worker" }
  ],
  "start_time": "2026-09-29T09:00:00.000Z",
  "end_time": "2026-09-29T13:00:00.000Z",
  "force": false // optional, only needed to override a scheduling conflict on a NEW worker
}
```

### What's different in behavior

- **This now merges instead of overwriting.** Any worker whose `_id` is already on the shift keeps their `check_in_at` / `check_out_at` / coordinates exactly as they were — only their `role` can change. A worker not in the payload is removed. A worker not currently on the shift is added fresh (not checked in yet).
- ⚠️ **You must always send the full desired roster**, not a diff. If you only send the new worker and leave out the existing ones, the existing ones get removed. This was already true before, but it matters more now that editing after check-in is a real, expected action — don't build an "add worker" button that sends just `[{ worker: newWorkerId, role }]`.
- **`start_time` / `end_time` are silently ignored once the shift has started** (status `in_progress` or `completed`). You can still send them (validation still requires them in the body), but the backend won't apply them — the schedule is frozen once work begins.
- Scheduling-conflict checks (`force` flow) now only apply to the **newly added** worker(s) — an existing worker already on the shift will never come back flagged as conflicting.

### What to build/change in the UI

- [ ] **Enable the "edit crew" action on `in_progress` shifts.** If it's currently disabled/hidden once a shift starts, remove that restriction — this is the whole point of the feature.
- [ ] When opening the edit-crew screen for a started shift, show each current worker's check-in status (checked in / not yet / checked out) so the manager can see who's actually on site before deciding who to swap.
- [ ] Build "remove worker" and "add worker" as edits to the **same full list**, then submit the whole list in one call — not as separate add/remove requests.
- [ ] Gray out / hide the start-time and end-time fields once the shift is `in_progress` or `completed`, since edits there are now silently no-ops. Showing editable fields that don't do anything is worse than not showing them.
- [ ] When removing a worker who has already checked in, show a confirmation: **"This worker will not be paid for time already worked on this shift."** (See §4 — removal forfeits pay by design.)

---

## 3. Endpoint — Check-out

`PATCH /shift/{planId}/{date}/check-out`

**Request and response shape are unchanged.**

```jsonc
// Request body — unchanged
{ "latitude": 23.78, "longitude": 90.41 }
```

### What's different in behavior

- **Old rule:** every worker's checkout was blocked until the *entire shift* was marked `completed` (all tasks/photos done).
- **New rule:** any worker can check out anytime after checking in — **except the last one still on site**. Only the last remaining worker is blocked until all tasks are done.

### New error case to handle

| Status | Message | When | What to show |
|---|---|---|---|
| `400` | `"All tasks must be completed before the last worker can check out"` | This worker is the only one left checked-in, and the shift isn't `completed` yet | A specific message — e.g. *"You're the last one here — finish the remaining tasks before checking out"* — not the old generic "shift not completed" text |

### What to build/change in the UI

- [ ] Remove any client-side logic that blocks the check-out button for every worker until the shift shows `completed` — that's no longer correct for anyone except the last person on site.
- [ ] Handle the new error message above distinctly from other check-out errors (e.g. "already checked out", "not checked in yet") — it's actionable and worth a clearer prompt than a generic toast.
- [ ] Optional but recommended: show a small "X worker(s) still on site" indicator so a worker checking out understands whether they're the one the task-completion rule applies to.

---

## 4. Pay / earnings display — read this before touching any balance UI

**Pay is no longer credited at the moment of each worker's own checkout.** It's settled once, for the whole crew, at the instant the *last* checked-in worker checks out. At that point, the shift's total duration is split evenly across everyone who checked in, and everyone's balance updates together.

Implications for the UI:

- [ ] **Don't assume a worker's earnings/balance updates immediately after their own checkout.** If they're not the last one out, their pay hasn't been credited yet — it will be, once the rest of the crew finishes and checks out. Don't show a stale "$0 earned" as if something failed.
- [ ] Any "today's payroll" / shift-earnings widget on the manager side should reflect this same delay — a shift's earnings only appear once every checked-in worker has checked out.
- [ ] **A worker removed from the crew after checking in gets $0 for that shift**, even for time already worked — this is intentional (see §2). Their check-in/check-out record still stays visible in attendance history for audit purposes, it just doesn't produce pay. Make sure whatever screen shows "worker earnings per shift" doesn't look like a bug when this happens — consider a small note like *"Removed from shift — not paid"* next to their entry if they show up in a shift's worker list at all.

---

## 5. Quick summary checklist

| # | Change | Required? |
|---|---|---|
| 1 | Enable "edit crew" on started shifts | **Required** |
| 2 | Always send the full worker list on edit, never a diff | **Required** |
| 3 | Handle the new last-worker checkout error message distinctly | **Required** |
| 4 | Remove the "must be completed to check out" block for non-last workers | **Required** |
| 5 | Disable start/end time fields once shift has started | Recommended |
| 6 | Show check-in status per worker on the edit-crew screen | Recommended |
| 7 | Don't assume balance updates right after checkout | Recommended |
| 8 | Confirmation dialog when removing a checked-in worker | Recommended |
