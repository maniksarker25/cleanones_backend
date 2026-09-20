/**
 * The only file the rest of the app imports.
 *
 *   checkPhoto()     ~150ms, measurement only, may refuse an upload
 *   evaluatePhoto()  2-3s, calls the model, never refuses
 *
 * Neither throws; failures come back as a status so an outage cannot break a
 * photo upload or change task completion.
 */
import axios from 'axios';
import { photoAiConfig, isPhotoAiReady } from './photo_ai.config';
import { prepareForModel, runGate } from './photo_ai.gate';
import { GeminiOutcome, evaluateWithRetry } from './photo_ai.gemini';
import {
    computeAgreement,
    computeConfidence,
    computeCoverage,
    computeScore,
    decide,
    toChecks,
} from './photo_ai.scoring';
import {
    IAiResult,
    IEvaluationInput,
    IGateResult,
    IPhotoAiFields,
} from './photo_ai.interface';

/**
 * Gate a photo before it is stored. Returns `ok` on internal error so a bug
 * here cannot stop a worker submitting completed work.
 */
export const checkPhoto = async (
    buffer: Buffer,
    previousHashes: string[] = []
): Promise<IGateResult> => {
    try {
        return await runGate(buffer, previousHashes);
    } catch {
        return {
            status: 'ok',
            metrics: { sharpness: 0, brightness: 0, width: 0, height: 0 },
            phash: '',
        };
    }
};

/**
 * Gate a photo already in S3. Uploads go straight to S3 via multer-s3 and the
 * shift endpoint receives only a URL, so the bytes are fetched back here.
 * Budget 150-400ms for the CDN on top of the measurement. Fails open.
 */
export const checkPhotoByUrl = async (
    photoUrl: string,
    previousHashes: string[] = []
): Promise<IGateResult> => {
    try {
        const response = await axios.get<ArrayBuffer>(photoUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
        });
        return await checkPhoto(Buffer.from(response.data), previousHashes);
    } catch {
        return {
            status: 'ok',
            metrics: { sharpness: 0, brightness: 0, width: 0, height: 0 },
            phash: '',
        };
    }
};

const fail = (
    status: IAiResult['status'],
    reason: string,
    started: number,
    error?: string
): IAiResult => ({
    status,
    score: null,
    confidence: null,
    reason,
    checks: [],
    subject_matches: null,
    requirement_met: null,
    model: photoAiConfig.gemini.model,
    duration_ms: Date.now() - started,
    error,
});

/**
 * Evaluate a stored photo against its requirement. Runs after the photo is
 * saved and the task has completed. Safe to call fire-and-forget, from a
 * background job or from a cron sweep.
 */
export const evaluatePhoto = async (
    input: IEvaluationInput,
    photoBuffer?: Buffer
): Promise<IAiResult> => {
    const started = Date.now();

    if (!isPhotoAiReady()) {
        return fail('skipped', 'AI verification is not enabled.', started);
    }

    // Use the caller's bytes when available, otherwise fetch.
    let buffer = photoBuffer;
    if (!buffer) {
        try {
            const response = await axios.get<ArrayBuffer>(input.photo_url, {
                responseType: 'arraybuffer',
                timeout: photoAiConfig.gemini.timeout_ms,
            });
            buffer = Buffer.from(response.data);
        } catch {
            return fail(
                'error',
                'Could not read the uploaded photo.',
                started,
                'photo fetch failed'
            );
        }
    }

    let photoBase64: string;
    try {
        photoBase64 = await prepareForModel(buffer);
    } catch {
        return fail('error', 'Photo could not be processed.', started, 'resize failed');
    }

    // Repeat runs measure how stable the judgement is on this photo.
    const samples = Math.max(1, photoAiConfig.gemini.samples);
    const outcomes = await Promise.all(
        Array.from({ length: samples }, () => evaluateWithRetry(input, photoBase64))
    );

    const successful = outcomes.filter(
        (outcome): outcome is Extract<GeminiOutcome, { ok: true }> => outcome.ok
    );

    if (successful.length === 0) {
        const firstFailure = outcomes.find(
            (outcome): outcome is Extract<GeminiOutcome, { ok: false }> =>
                !outcome.ok
        );
        return fail(
            firstFailure?.retryable ? 'pending' : 'error',
            'Automatic check unavailable — a manager will review.',
            started,
            firstFailure?.error ?? 'unknown'
        );
    }

    // First run supplies the checks and wording; the rest measure spread.
    const primary = successful[0].data;
    const checks = toChecks(primary);
    const score = computeScore(checks);
    const coverage = computeCoverage(checks);
    const agreement = computeAgreement(
        successful.map((outcome) => computeScore(toChecks(outcome.data)))
    );

    const gateMetrics = await runGate(buffer)
        .then((result) => result.metrics)
        .catch(() => ({ sharpness: 0, brightness: 0, width: 0, height: 0 }));

    const confidence = computeConfidence(gateMetrics, coverage, agreement);
    const outcome = decide(
        score,
        confidence,
        primary.summary,
        primary.subject_matches_title,
        primary.requirement_met
    );

    return {
        status: outcome.status,
        score,
        confidence,
        reason: outcome.reason,
        checks,
        subject_matches: primary.subject_matches_title,
        requirement_met: primary.requirement_met,
        model: photoAiConfig.gemini.model,
        duration_ms: Date.now() - started,
    };
};

/** Fields to persist on the photo requirement. */
export const gateResultToFields = (result: IGateResult): IPhotoAiFields => ({
    gate_status: result.status,
    gate_reason: result.reason,
    gate_metrics: result.metrics,
    phash: result.phash,
});

/**
 * In shadow mode a passed/failed verdict is recorded but downgraded to
 * `review`, so it can be compared against manager decisions later without
 * influencing anything meanwhile.
 */
export const aiResultToFields = (result: IAiResult): IPhotoAiFields => ({
    ai_status: photoAiConfig.shadow_mode
        ? result.status === 'passed' || result.status === 'failed'
            ? 'review'
            : result.status
        : result.status,
    ai_score: result.score,
    ai_confidence: result.confidence,
    ai_reason: result.reason,
    ai_checks: result.checks,
    ai_subject_matches: result.subject_matches,
    ai_requirement_met: result.requirement_met,
    ai_model: result.model,
    ai_evaluated_at: new Date(),
    ai_error: result.error,
});

export const PhotoAiService = {
    checkPhoto,
    checkPhotoByUrl,
    evaluatePhoto,
    gateResultToFields,
    aiResultToFields,
};
