# photo_ai

Automated checking of worker-submitted proof photos.

**Full documentation: [`docs/PHOTO_AI_VERIFICATION.md`](../../../../docs/PHOTO_AI_VERIFICATION.md)**

## Quick reference

```ts
PhotoAiService.checkPhotoByUrl(url, { sameShift, otherShifts })  // gate, may refuse
PhotoAiService.evaluatePhoto(input, buffer?)                     // model, never refuses
```

Neither throws. Failures come back as a status.

```bash
npm install sharp        # the only new dependency
```

```bash
PHOTO_AI_ENABLED=false   # default; nothing runs
PHOTO_AI_SHADOW_MODE=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

## Two rules

**The gate may refuse an upload; the model may not.** Blur and exposure are
measurements. A model's judgement is not, so it runs after the fact and only
writes flags.

**`is_completed` never depends on the AI.** A task completes when every
required photo is uploaded, exactly as before this feature existed.

## Before you refactor

Read §19 of the full documentation. Several things here look like mistakes and
are not — the hand-rolled hex dHash, the empty catch blocks, and the image
ordering in the Gemini request all have reasons.
