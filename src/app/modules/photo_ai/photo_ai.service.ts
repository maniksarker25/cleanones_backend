import axios from 'axios';
import { photoAiConfig, isPhotoAiReady } from './photo_ai.config';
import { IReuseCandidates, prepareForModel, runGate } from './photo_ai.gate';
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

export const checkPhoto = async (
    buffer: Buffer,
    previous: string[] | IReuseCandidates = []
): Promise<IGateResult> => {
    try {
        return await runGate(buffer, previous);
    } catch {
        return {
            status: 'ok',
            metrics: { sharpness: 0, brightness: 0, width: 0, height: 0 },
            phash: '',
        };
    }
};

export const checkPhotoByUrl = async (
    photoUrl: string,
    previous: string[] | IReuseCandidates = []
): Promise<IGateResult> => {
    try {
        const response = await axios.get<ArrayBuffer>(photoUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
        });
        return await checkPhoto(Buffer.from(response.data), previous);
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

export const evaluatePhoto = async (
    input: IEvaluationInput,
    photoBuffer?: Buffer
): Promise<IAiResult> => {
    const started = Date.now();

    if (!isPhotoAiReady()) {
        return fail('skipped', 'AI verification is not enabled.', started);
    }

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

export const gateResultToFields = (result: IGateResult): IPhotoAiFields => ({
    gate_status: result.status,
    gate_reason: result.reason,
    gate_metrics: result.metrics,
    phash: result.phash,
});

const resolveStatus = (result: IAiResult): IAiResult['status'] => {
    if (photoAiConfig.shadow_mode) {
        return result.status === 'passed' || result.status === 'failed'
            ? 'review'
            : result.status;
    }
    if (photoAiConfig.auto_only && result.status !== 'failed') {
        return 'passed';
    }
    return result.status;
};

export const aiResultToFields = (result: IAiResult): IPhotoAiFields => ({
    ai_status: resolveStatus(result),

    ...(photoAiConfig.auto_only && !photoAiConfig.shadow_mode
        ? {
              auto_decided: true,
              auto_decision: (result.status === 'failed'
                  ? 'rejected'
                  : 'approved') as 'approved' | 'rejected',
              auto_decided_at: new Date(),
          }
        : {}),
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
