# Photo AI Verification

Automated checking of worker-submitted proof photos.

**Status:** implemented, disabled by default (`PHOTO_AI_ENABLED=false`).
**Module:** `src/app/modules/photo_ai/`
**Integration:** `src/app/modules/shift/`

---

## 1. Overview

A worker photographs a zone as proof the cleaning was done. The system:

1. Measures the photo (blur, exposure, size, reuse) — may refuse the upload.
2. Asks a vision model whether it satisfies the requirement — may not refuse.
3. Records a verdict a manager can act on, or decides on its own.

Two invariants hold everywhere and must not be broken:

| Invariant | Why |
|---|---|
| **The gate may refuse an upload; the model may not.** | Blur and exposure are measurements, repeatable and not open to opinion. A model's judgement is neither, so it runs after the fact and only writes flags. |
| **`is_completed` never depends on the AI.** | A task completes when every required photo is uploaded, exactly as before this feature. If Gemini is down, wrong or slow, the system behaves as it did before. |

---

## 2. File map

```
src/app/modules/photo_ai/
  photo_ai.config.ts      env parsing, thresholds, operating modes
  photo_ai.gate.ts        sharp measurements, dHash, downscale for the model
  photo_ai.prompt.ts      system instruction, response schema, prompt builder
  photo_ai.gemini.ts      provider client, retry, zod validation
  photo_ai.scoring.ts     score, coverage, agreement, confidence, decide()
  photo_ai.service.ts     public entry points
  photo_ai.cron.ts        escalation / auto-accept / pending-retry sweeps
  photo_ai.interface.ts   types

src/app/modules/shift/
  shift.services.ts       uploadShiftTaskPhoto        gate + evaluation hooks
                          collectRoomPhotoHashes      reuse candidates
                          saveAiFields                writes the result back
                          setPhotoVerdict             manager decision
                          promoteApprovedPhotoToReference
                          getPhotoReviewListFromDB    manager queue
                          summarisePhotoQuality       worker stats
  shift.model.ts          photoRequirementSchema carries every field
  shift.routes.ts         photo-verdict route; imports the cron module
```

Provider knowledge is confined to `photo_ai.gemini.ts`. Swapping Gemini for
another vendor means rewriting that one file.

---

## 3. Public API of the module

```ts
PhotoAiService.checkPhoto(buffer, previous?)       // gate, from bytes
PhotoAiService.checkPhotoByUrl(url, previous?)     // gate, fetches the bytes
PhotoAiService.evaluatePhoto(input, buffer?)       // model call
PhotoAiService.gateResultToFields(result)          // → IPhotoAiFields
PhotoAiService.aiResultToFields(result)            // → IPhotoAiFields
```

Neither entry point throws. Failures are returned as a status.

```ts
// previous: either a flat array (treated as same-shift) or
{ sameShift?: string[]; otherShifts?: string[] }
```

---

## 4. Upload flow, every branch

`PATCH /shift/:planId/:date/tasks/:taskId/photo` — auth `worker`,
body `{ title, photo_url }`.

Uploads reach S3 through multer-s3 **before** this endpoint, so the handler
receives a CloudFront URL and never the bytes. The gate fetches them back.

```
1  worker assigned to this shift?           no → 403
2  task exists on this shift?               no → 404
3  title matches a requirement?             no → 400 "Unknown photo requirement"
4  attempts = requirement.attempt_count + 1
5  collectRoomPhotoHashes(room, shift)      → { sameShift, otherShifts }
6  checkPhotoByUrl(photo_url, candidates)   ~300–550 ms
7  gate rejected AND attempts < max?
       yes → persist attempt_count, gate_status, gate_reason, gate_metrics
             throw 400 with gate.reason          PHOTO NOT STORED
       no  → continue (forced = rejected && attempts >= max)
8  write photo_url, is_uploaded, attempt_count, forced_accept,
         gate_status, gate_reason, gate_metrics, phash,
         ai_status = 'pending'
9  recomputeTaskCompletion → is_completed = every photo uploaded
10 maybeAutoCompleteShift  → shift status if every task done
11 void evaluatePhoto(...).then(saveAiFields)      NOT awaited
12 return the shift
```

Step 11 runs after the response is on its way. A failure there cannot affect
the request, `is_completed`, or the shift status.

---

## 5. Gate

Pure measurement on the image pixels. No model call, no cost, repeatable.

| Check | Method | Rejects when | Env |
|---|---|---|---|
| Size | long edge | `< 640` | `PHOTO_AI_MIN_LONG_EDGE` |
| Darkness | mean luminance | `< 32` | `PHOTO_AI_MIN_BRIGHTNESS` |
| Brightness | mean luminance | `> 232` | `PHOTO_AI_MAX_BRIGHTNESS` |
| Sharpness | Laplacian variance, 512px copy | `< 90` | `PHOTO_AI_MIN_SHARPNESS` |
| Reuse, same shift | dHash Hamming | `<= 5` | `PHOTO_AI_PHASH_DISTANCE` |
| Reuse, other days | dHash Hamming | `<= 1` | `PHOTO_AI_PHASH_STRICT_DISTANCE` |

Checks run in that order and the first failure is returned, so the worker is
told one thing to fix rather than a list.

### Worker-facing messages

| Message | Cause |
|---|---|
| `Photo resolution is too low. Please retake.` | long edge below minimum |
| `Photo is too dark. Turn on a light and retake.` | mean luminance below minimum |
| `Photo is too bright. Move away from the light and retake.` | mean luminance above maximum |
| `Photo is blurry. Hold the camera steady and retake.` | Laplacian variance below minimum |
| `This photo was already used for another item. Take a new one.` | matches another photo in the same shift |
| `This photo was submitted on an earlier day. Take a new one.` | exact match against an earlier day |

These are written for workers. Return `message` verbatim; do not append
anything technical.

### Reuse detection — two thresholds, and why

A room cleaned to the same standard photographs almost identically every day.
Comparing across days with a loose threshold rejects correct work.

Measured distances on the same source photo:

| Variation | Distance |
|---|---|
| identical file | 0 |
| recompressed to q60 | 0 |
| different lighting | 2 |
| rotated 2° | 8 |
| zoomed 12% | 21 |
| camera shifted 3% | 26 |
| a different bathroom entirely | 33 |

So:

* **Same shift, `<= 5`.** Submitting one photo for two requirements on the
  same day is always wrong, and near-matches are worth catching.
* **Other days, `<= 1`.** Only an effectively identical file means reuse. A
  re-photographed room scores 2 or more, and rejecting that would reject
  correct work every single day.

`PHOTO_AI_PHASH_STRICT_DISTANCE=0` tightens this to exact matches only; `1` is
the default so CDN recompression does not defeat it.

### Retake limit

After `PHOTO_AI_MAX_ATTEMPTS` (default 3) consecutive rejections the photo is
accepted anyway and flagged `forced_accept: true`, so a worker is never
stranded on site. Rejected attempts still write `attempt_count`,
`gate_reason` and `gate_metrics` even though the photo is not stored, so
repeated failures remain visible.

### Failure mode

The gate **fails open**. Any internal error, or an unreachable photo URL,
returns `ok`. A bug in the safety check must never stop a worker recording
completed work.

---

## 6. Evaluation

### Sent to the model

| Field | Source | Notes |
|---|---|---|
| photo | the uploaded file | downscaled to 1024px long edge, JPEG q82 |
| `title` | requirement | always present |
| `description` | requirement | optional, usually null |
| `reference_image_url` | requirement | optional; attached **before** the submitted photo |
| `room_name`, `room_type` | shift snapshot | |
| `task_name` | shift snapshot | |
| `cleaning_type` | shift snapshot | adds a note that disinfection is unverifiable |
| `examples` | — | supported by the prompt builder, nothing populates it yet |

**The submitted photo must be the last image in the request.** The prompt says
so. Appending another image after it silently changes which photo is judged.

### Returned, after zod validation

```jsonc
{
  "subject_matches_title": boolean,  // false only for a different subject entirely
  "requirement_met": boolean,        // the overall verdict
  "checks": [{ "item": string, "passed": "yes"|"no"|"cannot_tell", "note"?: string }],
  "summary": string
}
```

There is **no score field, deliberately**. A model asked for a percentage
returns an unstable number — the same photo scored 87, then 79. The score is
derived in `photo_ai.scoring.ts` instead, where it is reproducible and each
point traces back to a named check.

`cannot_tell` maps to `null` and leaves the denominator. Counting unseen items
as failures penalises the worker for the camera angle.

### Behaviour without a description

Most requirements carry only a title such as `"Top photo"`. The prompt then
uses room type, room name and task name as the reference and judges two things
only: does the photo show that place, and does the area look clean.

Measured at **7/9** for subject detection on room type alone. A written
description raises it further and is the cheapest accuracy improvement
available.

### Prompt injection

`title` and `description` are typed by managers and clients. They are wrapped
in `<requirement>` delimiters and the system instruction states they are data
and that instructions inside them must be ignored.

---

## 7. Scoring

```
assessed    = checks where passed !== null
score       = passed / assessed × 100        // null when assessed is empty
coverage    = assessed / total checks
agreement   = clamp(1 − stdev(repeat run scores) / 40)   // 0.8 when samples < 2

sharpnessScore = clamp(sharpness / (min_sharpness × 2.5))
exposureScore  = clamp(1 − |brightness − midBand| / halfBand)
imageQuality   = 0.5 + 0.5 × (0.6 × sharpnessScore + 0.4 × exposureScore)

confidence  = imageQuality × coverage × agreement
```

The confidence terms **multiply**, so one weak signal pulls the whole value
down. It is built from independent evidence, never the model's self-report.

With `GEMINI_SAMPLES=1` the agreement term returns a fixed `0.8` rather than
`1.0`: a single sample provides no evidence of stability.

---

## 8. Decision

Evaluated in this order. First match wins.

| # | Condition | Result |
|---|---|---|
| 1 | `score === null` | `review` |
| 2 | `confidence < 0.6` | `review` |
| 3 | `subject_matches === false` | `failed` |
| 4 | `requirement_met === false` | `failed` |
| 5 | `requirement_met === true` and `score < 75` | `review` |
| 6 | `requirement_met === true` and `score >= 75` | `passed` + audit sample |
| 7 | `requirement_met === null` and `score < 45` | `failed` |
| 8 | otherwise | `review` |

**`requirement_met` decides, not the score.** The model decomposes a
requirement differently on each call; a requirement listing four things can
fail the important one and still score 75%. That is exactly what bench testing
produced before `requirement_met` was added. The score remains as the
explanation shown to a manager.

Row 5 is a contradiction — the model says met, the checks disagree — and is
handed to a person rather than resolved automatically.

**`PHOTO_AI_MIN_CONFIDENCE = 0.6` is an estimate, not a measurement.** Neither
it nor the confidence formula has been shown to track correctness on
production photos. Manager verdicts are the only ground truth that can fix
this; see §12.

### Audit sampling

`PHOTO_AI_AUDIT_RATE` (default `0.05`) of auto-approved photos are flagged
`audit_sampled` and sent to a manager anyway.

A wrong rejection generates a complaint and self-reports. A wrong approval is
never looked at again, so this sample is the only mechanism by which model
drift surfaces before a client notices it. Set to `0` to disable.

---

## 9. Operating modes

Three booleans, four effective modes.

| Mode | Config | Gate | Evaluation | Stored status |
|---|---|---|---|---|
| Off | `ENABLED=false` | off | off | nothing written |
| Shadow | `ENABLED=true`, `SHADOW_MODE=true` | **on** | on | `passed`/`failed` → `review` |
| Assisted | both false | on | on | as decided |
| Automatic | `AUTO_ONLY=true` | on | on | see below |

### Status mapping per mode

| Model result | Shadow | Assisted | Automatic |
|---|---|---|---|
| `passed` | `review` | `passed` | `passed` + `auto_decision: approved` |
| `failed` | `review` | `failed` | `failed` + `auto_decision: rejected` |
| `review` | `review` | `review` | `passed` + `auto_decision: approved` |
| `error` | `error` | `error` | `passed` + `auto_decision: approved` |
| `pending` | `pending` | `pending` | `passed` + `auto_decision: approved` |
| `skipped` | `skipped` | `skipped` | `passed` + `auto_decision: approved` |

In Automatic mode anything the model was not confident about is **approved**,
not rejected. With no appeal route, rejecting on uncertainty penalises workers
for the model's doubt.

Automatic mode also removes the only source of ground truth for tuning the
confidence threshold. Leaving `PHOTO_AI_AUDIT_RATE` above zero keeps a slice
of that data flowing.

### Two configuration traps

* **Config is read once, at module load.** Editing `.env` on a running server
  changes nothing until restart.
* **Duplicate keys.** `dotenv` keeps the **first** occurrence. A value appended
  at the bottom of `.env` is ignored if the key already appears above it.

---

## 10. Who decided what

Three independent records can sit on one photo. None overwrites another.

| Field | Written by | Meaning |
|---|---|---|
| `ai_status` | evaluation | what the model concluded |
| `auto_decision` | Automatic mode | what the system decided without a human |
| `manager_verdict` | verdict endpoint only | what a person decided |

`manager_verdict_by` holds the manager's id and is the proof a human was
involved. Rows written before this separation existed carry `manager_verdict`
with `manager_verdict_by: null`.

Keeping them apart matters: an approval rate made entirely of machine
decisions means something different from one a person signed off.

---

## 11. Manager queue

`GET /shift/photo-review` — auth `manager`.
Query: `from`, `to`, `planId`, `locationId`, `status`. All optional.
Default range: last 30 days.

`status` accepts `pending`, `decided`, `all`.

### Ordering

Rows arrive sorted by `review_priority`, then newest first. **Do not re-sort
in the client** — the ordering encodes which rows are most likely to be a real
problem.

| Priority | Condition |
|---|---|
| 1 | `forced_accept` — could not produce a usable photo |
| 2 | `ai_subject_matches === false` |
| 3 | `ai_status === 'failed'` |
| 4 | `ai_status === 'review'` |
| 5 | `audit_sampled` |
| 6 | `ai_status` is `error` or `pending` |
| 7 | no `ai_status` — never checked |
| 8 | anything else |
| 80 | `ai_status === 'passed'` |
| 85 | `auto_decided` |
| 90 | `manager_verdict` set |

### needs_review

Per photo:

```
false if manager_verdict is set
false if auto_decided        (unless audit_sampled)
false if auto_accepted
false if ai_status === 'passed' (unless audit_sampled)
true  otherwise
```

Row level is `some(photo => photoNeedsReview(photo))`, so a row stays flagged
while **any** of its photos is undecided. A task with three photos where one
has been approved still reports `needs_review: true`.

---

## 12. Manager verdict

`PATCH /shift/:planId/:date/tasks/:taskId/photo-verdict` — auth `manager`.

```jsonc
{ "title": "Top photo", "verdict": "approved" | "rejected", "note": "optional" }
```

Errors: `400` unknown requirement, `400` no photo uploaded yet, `404` task not
found, `403` not permitted.

### What it changes

```
manager_verdict, manager_verdict_by, manager_verdict_at, manager_note
auto_accepted → false          (so the 7-day sweep cannot claim it later)
```

### What it does not change

`is_completed`, `photo_url`, `is_uploaded`, `ai_status`, `ai_score`,
`auto_decision`, shift status. The AI's verdict is preserved deliberately: the
disagreement between it and the manager is the only measure of whether the
thresholds are right.

### Consequences

**1 — approved photos become the reference.**
On approval, `photo_url` is written to the **source Task** as
`reference_image_url`, so later shifts are judged against a real approved
example rather than a written description. This is the only thing that makes a
directional requirement such as `"left photo"` checkable at all, and each
client's standard accumulates without configuration. The current shift's
snapshot is left as it was on the day. A failure here is swallowed — the
verdict must still be recorded.

**2 — it counts toward the worker.**

`GET /shift/worker-performance/:workerId`

```jsonc
"photo_quality": {
  "total_photos": 18,
  "approved": 9,
  "rejected": 2,
  "approval_rate": 81.82,       // of decided photos
  "reviewed_by_manager": 11,    // decided by a person, not the machine
  "retakes": 16,                // gate rejections worked past
  "forced_accepts": 1
}
```

A verdict does **not** reopen the task, create follow-up work, or affect
billing. The worker has already left the site; the verdict is a quality
record.

---

## 13. Failure handling

| Failure | Detected in | Stored as | Retry | Worker sees |
|---|---|---|---|---|
| AI disabled / no key | `isPhotoAiReady` | `skipped` | no | nothing |
| Photo URL unfetchable | `evaluatePhoto` | `error` | no | nothing |
| Resize throws | `prepareForModel` | `error` | no | nothing |
| HTTP 5xx / timeout / network | `evaluateOnce` | `pending` | 3×, backoff | nothing |
| HTTP 429 | `evaluateOnce` | `pending` | 3×, backoff | nothing |
| HTTP 4xx other than 429 | `evaluateOnce` | `error` | no | nothing |
| Invalid JSON | `JSON.parse` | `pending` | 3×, backoff | nothing |
| Schema mismatch | zod | `pending` | 3×, backoff | nothing |
| Confidence below floor | `decide` | `review` | — | nothing |
| Past retry ceiling | retry sweep | `skipped` | stops | nothing |
| Gate throws internally | `checkPhoto` | — (returns `ok`) | — | nothing |
| Gate rejects | gate | not stored | — | **retake message** |

```
backoff = PHOTO_AI_RETRY_DELAY_MS × 2^attempt     // 1s, 2s, 4s
ceiling = PHOTO_AI_RETRY_CEILING_HOURS            // default 6
```

An AI problem can never block a worker. In the worst case the system behaves
as it did before this module existed.

---

## 14. Scheduled sweeps

Scheduled on import of `photo_ai.cron.ts`, which `shift.routes.ts` pulls in —
the same pattern as `device.service.ts`.

| Sweep | Schedule | Does | Env |
|---|---|---|---|
| escalation | `7 * * * *` | sets `escalated_at` on anything unreviewed past the window | `PHOTO_AI_ESCALATE_HOURS` (48) |
| auto-accept | `10 3 * * *` | sets `auto_accepted` after the window so the queue stays finite | `PHOTO_AI_AUTO_ACCEPT_DAYS` (7) |
| pending-retry | `*/20 * * * *` | re-runs stuck evaluations; marks `skipped` past the ceiling | `PHOTO_AI_RETRY_CEILING_HOURS` (6) |

Both windows skip photos that already carry a `manager_verdict` or
`auto_accepted`.

`auto_accepted` is a **measurement, not a status**: it means nobody looked
before the deadline. Surfacing it is what tells you, months later, whether
review is real or whether the queue is quietly expiring.

The escalation sweep sets the field but **sends no notification**. Wiring it to
the `notification` module is outstanding.

---

## 15. Database fields

All added to `photoRequirementSchema` in `shift.model.ts`. Every field is
optional, so existing documents stay valid with no migration.

### Gate

| Field | Type | Notes |
|---|---|---|
| `gate_status` | `'ok' \| 'rejected'` | |
| `gate_reason` | `string` | the worker-facing message |
| `gate_metrics` | `{ sharpness, brightness, width, height }` | useful for tuning thresholds |
| `phash` | `string` | 16 hex chars, 64-bit dHash |
| `attempt_count` | `number` | includes rejected attempts |
| `forced_accept` | `boolean` | accepted because the retake limit was hit |

### Evaluation

| Field | Type |
|---|---|
| `ai_status` | `pending \| passed \| failed \| review \| error \| skipped` |
| `ai_score` | `number \| null` — 0–100 |
| `ai_confidence` | `number \| null` — 0–1 |
| `ai_reason` | `string` — one sentence for a manager |
| `ai_checks` | `[{ item, passed: boolean \| null, note }]` |
| `ai_subject_matches` | `boolean \| null` |
| `ai_requirement_met` | `boolean \| null` |
| `ai_model` | `string` |
| `ai_evaluated_at` | `Date` |
| `ai_error` | `string` |
| `audit_sampled` | `boolean` |

### Decisions

| Field | Type |
|---|---|
| `manager_verdict` | `'approved' \| 'rejected' \| null` |
| `manager_verdict_by` | `ObjectId \| null` |
| `manager_verdict_at` | `Date \| null` |
| `manager_note` | `string \| null` |
| `auto_decided` | `boolean` |
| `auto_decision` | `'approved' \| 'rejected' \| null` |
| `auto_decided_at` | `Date \| null` |
| `escalated_at` | `Date \| null` |
| `auto_accepted` | `boolean` |

---

## 16. Configuration reference

```bash
# master switches
PHOTO_AI_ENABLED=false               # nothing runs when false
PHOTO_AI_SHADOW_MODE=true            # record verdicts, act on none
PHOTO_AI_AUTO_ONLY=false             # decide everything, no manager

# provider
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_TIMEOUT_MS=20000
GEMINI_SAMPLES=1                     # >1 enables the agreement measure

# gate
PHOTO_AI_MIN_SHARPNESS=90            # scale-dependent, see §5
PHOTO_AI_MIN_BRIGHTNESS=32
PHOTO_AI_MAX_BRIGHTNESS=232
PHOTO_AI_MIN_LONG_EDGE=640
PHOTO_AI_PHASH_DISTANCE=5            # same shift
PHOTO_AI_PHASH_STRICT_DISTANCE=1     # other days
PHOTO_AI_MAX_ATTEMPTS=3

# decision
PHOTO_AI_APPROVE_AT=75
PHOTO_AI_FAIL_BELOW=45
PHOTO_AI_MIN_CONFIDENCE=0.6          # unvalidated estimate
PHOTO_AI_AUDIT_RATE=0.05

# retry and sweeps
PHOTO_AI_RETRY_ATTEMPTS=3
PHOTO_AI_RETRY_DELAY_MS=1000
PHOTO_AI_RETRY_CEILING_HOURS=6
PHOTO_AI_ESCALATE_HOURS=48
PHOTO_AI_AUTO_ACCEPT_DAYS=7

# image
PHOTO_AI_IMAGE_LONG_EDGE=1024
PHOTO_AI_JPEG_QUALITY=82
```

---

## 17. Cost

| Item | Value |
|---|---|
| Gate | free, no model call |
| Gate rejections | free, however many retries |
| One evaluation | ~2,400 input + ~700 output tokens |
| Cost per photo | ~$0.0025 on `gemini-3.5-flash-lite` |
| Tasks with `is_photo_required: false` | no call at all |

Only accepted photos reach the model — the gate throws before the evaluation
call — so a worker retaking a blurry photo three times costs nothing.

Image long edge drives most of the input cost. Gemini bills 258 tokens per
768px tile, so 1024px costs roughly a third of 2048px with no useful loss for
judging whether a room is tidy.

---

## 18. Known limits

* **Disinfection cannot be verified.** Bleach and water photograph identically.
  The prompt states this and the model is told never to claim otherwise.
* **Identical rooms defeat subject matching.** Two rooms with the same layout
  can match. Job records and location data are the backstop, not the photo.
* **No smell, nothing under or behind furniture, nothing out of frame.**
* **The confidence threshold is unvalidated.** It needs manager verdicts to
  tune against, which Automatic mode removes.
* **The model learns nothing automatically.** There is no training. Accuracy
  improves through reference images and written descriptions, both of which
  take effect on the next request. `IEvaluationInput.examples` is supported by
  the prompt builder but nothing populates it yet.

---

## 19. Gotchas

Things that look like mistakes and are not, or that will bite a refactor.

* **The dHash is assembled as hex, not with `BigInt`.** This project's
  TypeScript target is below ES2020 and BigInt literals do not compile.
  "Simplifying" it breaks the build.
* **The submitted photo must be the last image in the Gemini request.** The
  prompt depends on it. Appending another attachment changes which photo is
  judged, silently.
* **Sharpness threshold is tied to the 512px resize** inside
  `laplacianVariance`. Change one and the other must be re-derived.
* **The gate fails open on purpose.** Do not "fix" the empty catch blocks in
  `checkPhoto` / `checkPhotoByUrl`.
* **`.env` duplicate keys.** dotenv keeps the first occurrence.
* **Config is read at module load.** Restart after changing `.env`.
* **Row-level `needs_review` is `some()`, not `every()`.** A task with one
  approved photo and two undecided ones still reports `true`.

---

## 20. Outstanding

| Item | Notes |
|---|---|
| Escalation notification | sweep sets `escalated_at`; nobody is told |
| Example library | `examples` plumbed through the prompt, unpopulated |
| Preset descriptions per room type | largest available accuracy gain, content not code |
| Socket event for live results | frontend polls instead |
| Error codes on the 400s | currently distinguished by message text |
| Migration for pre-separation rows | `manager_verdict` set with `manager_verdict_by: null` |
