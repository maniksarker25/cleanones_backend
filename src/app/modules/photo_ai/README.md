# photo_ai

Verification for worker-submitted photos. Self-contained — nothing here is
wired into the app yet and importing it changes no behaviour.

## Entry points

| Call | When | Duration | Can refuse? |
|---|---|---|---|
| `checkPhotoByUrl()` | before the photo is recorded | ~300–550 ms | yes |
| `evaluatePhoto()` | after the task has completed | 2–3 s | no |

`checkPhotoByUrl()` measures blur, exposure, size and reuse. No model call, no
cost, and the result is repeatable, so refusing an upload on it is safe.

`evaluatePhoto()` calls Gemini. It runs after the photo is saved and the task
has completed, so a wrong verdict costs a manager one review rather than a
worker a return trip. It never throws; failures come back as a status.

## Install

```bash
npm install sharp
```

`axios` and `zod` are already in the project.

## Environment

```bash
PHOTO_AI_ENABLED=false           # default; uploads behave as before
PHOTO_AI_SHADOW_MODE=true        # record verdicts, act on none
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

In shadow mode `passed`/`failed` is downgraded to `review` before being
stored, so verdicts can be compared against manager decisions without
influencing anything.

Remaining thresholds are in `photo_ai.config.ts`, all overridable by env var.
`PHOTO_AI_MIN_CONFIDENCE` is currently an estimate and should be re-derived
from real data before anything auto-approves on it.

## Wiring

### 1. Schema

```ts
import { IPhotoAiFields } from '../photo_ai/photo_ai.interface';

export interface IShiftPhotoRequirement extends IPhotoAiFields {
    title: string;
    description?: string | null;
    reference_image_url?: string | null;
    photo_url: string | null;
    is_uploaded: boolean;
}
```

All added fields are optional, so existing documents need no migration.

### 2. Gate, in `uploadShiftTaskPhoto()` before the write

```ts
const gate = await PhotoAiService.checkPhotoByUrl(photoUrl, previousHashes);
if (gate.status === 'rejected') {
    throw new AppError(httpStatus.BAD_REQUEST, gate.reason!);
}
```

`previousHashes` are the `phash` values already stored for this room and
title. Pass an empty array to skip the reuse check.

### 3. Evaluation, after `maybeAutoCompleteShift()`

```ts
void PhotoAiService.evaluatePhoto({
    photo_url: photoUrl,
    requirement: { title, description, reference_image_url },
    context: { room_type, cleaning_type, room_name },
})
    .then((result) => saveAiFields(shiftId, taskId, title, result))
    .catch(() => undefined);
```

Do not await it.

## Do not gate completion on the AI

`is_completed` must keep its current meaning — every required photo uploaded.
The evaluation is asynchronous, so at upload time its status is always
`pending`; gating completion on it either completes tasks that later fail, or
leaves tasks permanently incomplete whenever Gemini is unreachable.

Manager rejection belongs in the `/photo-review` flow.

## Failure behaviour

| Failure | Status stored | Worker sees |
|---|---|---|
| Gemini unreachable | `pending` | nothing |
| Invalid JSON after 3 retries | `pending` | nothing |
| HTTP 4xx other than 429 | `error` | nothing |
| Confidence below threshold | `review` | nothing |
| Disabled or no API key | `skipped` | nothing |
| Gate rejects | — | retake message |

An AI problem never blocks a worker. In the worst case the system behaves as
it did before this module.

## Not built yet

- Persisting the AI fields back onto the shift (`saveAiFields` above)
- Query for `previousHashes`
- Retry sweep for `pending` evaluations
- `attempt_count` / `forced_accept` tracking
- AI fields on `PhotoReviewRow`
- Manager approve/reject endpoint
