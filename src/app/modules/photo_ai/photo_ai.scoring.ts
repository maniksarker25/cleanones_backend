/**
 * Scoring and confidence. The score is derived from the model's yes/no
 * answers rather than returned by it, so it is reproducible and each point
 * traces back to a named check.
 */
import { photoAiConfig } from './photo_ai.config';
import { AiStatus, IAiCheck, IGateMetrics } from './photo_ai.interface';
import { ModelResponse } from './photo_ai.gemini';

export const toChecks = (response: ModelResponse): IAiCheck[] =>
    response.checks.map((check) => ({
        item: check.item,
        passed:
            check.passed === 'yes' ? true : check.passed === 'no' ? false : null,
        note: check.note,
    }));

/**
 * Scored over assessed checks only. Items the model could not see leave the
 * denominator rather than counting as failures, which would penalise the
 * worker for the camera angle. Returns null when nothing was assessable.
 */
export const computeScore = (checks: IAiCheck[]): number | null => {
    const assessed = checks.filter((check) => check.passed !== null);
    if (assessed.length === 0) return null;
    const passed = assessed.filter((check) => check.passed === true);
    return Math.round((passed.length / assessed.length) * 100);
};

/** Share of checks that could be judged. Feeds confidence. */
export const computeCoverage = (checks: IAiCheck[]): number => {
    if (checks.length === 0) return 0;
    const assessed = checks.filter((check) => check.passed !== null);
    return assessed.length / checks.length;
};

/**
 * Agreement across repeat runs. One sample gives no evidence of stability,
 * so it returns 0.8 rather than a perfect score.
 */
export const computeAgreement = (scores: (number | null)[]): number => {
    const valid = scores.filter((score): score is number => score !== null);
    if (valid.length < 2) return 0.8;
    const mean = valid.reduce((sum, score) => sum + score, 0) / valid.length;
    const variance =
        valid.reduce((sum, score) => sum + (score - mean) ** 2, 0) / valid.length;
    const spread = Math.sqrt(variance);
    return Math.max(0, Math.min(1, 1 - spread / 40));
};

/**
 * Confidence from independent evidence rather than the model's self-report.
 * The terms multiply so one weak signal pulls the whole value down.
 */
export const computeConfidence = (
    metrics: IGateMetrics,
    coverage: number,
    agreement: number
): number => {
    const { gate } = photoAiConfig;

    // The gate already refused anything below the minimum.
    const sharpnessScore = Math.max(
        0,
        Math.min(1, metrics.sharpness / (gate.min_sharpness * 2.5))
    );

    // Distance from the middle of the usable exposure band.
    const midpoint = (gate.min_brightness + gate.max_brightness) / 2;
    const halfBand = (gate.max_brightness - gate.min_brightness) / 2;
    const exposureScore = Math.max(
        0,
        Math.min(1, 1 - Math.abs(metrics.brightness - midpoint) / halfBand)
    );

    const imageQuality = 0.5 + 0.5 * (sharpnessScore * 0.6 + exposureScore * 0.4);

    const value = imageQuality * coverage * agreement;
    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
};

export interface IDecision {
    status: AiStatus;
    reason: string;
    audit_sampled: boolean;
}

/**
 * `requirementMet` decides the outcome, not the score. The model decomposes a
 * requirement differently on each call, so equal weighting over those checks
 * cannot carry an approve/reject decision: a requirement listing four things
 * can fail the important one and still score 75%. The score remains as the
 * explanation shown to a manager.
 */
export const decide = (
    score: number | null,
    confidence: number,
    modelSummary: string,
    subjectMatches: boolean | null,
    requirementMet: boolean | null
): IDecision => {
    const { decision } = photoAiConfig;

    if (score === null) {
        return {
            status: 'review',
            reason: 'Nothing in this photo could be assessed.',
            audit_sampled: false,
        };
    }

    if (confidence < decision.review_below_confidence) {
        return {
            status: 'review',
            reason: modelSummary || 'Confidence too low for an automatic decision.',
            audit_sampled: false,
        };
    }

    // A spotless photo of the wrong room still does not satisfy the brief.
    if (subjectMatches === false) {
        return {
            status: 'failed',
            reason: modelSummary || 'Photo does not show what the requirement asks for.',
            audit_sampled: false,
        };
    }

    if (requirementMet === false) {
        return {
            status: 'failed',
            reason: modelSummary || 'Requirement not met.',
            audit_sampled: false,
        };
    }

    if (requirementMet === true) {
        // Verdict and checks disagree. Hand it to a person.
        if (score < decision.approve_at_or_above) {
            return {
                status: 'review',
                reason:
                    modelSummary ||
                    'Overall verdict and individual checks disagree.',
                audit_sampled: false,
            };
        }
        // Sample a slice of approvals. A wrong rejection gets reported by
        // the worker; a wrong approval is never looked at again.
        return {
            status: 'passed',
            reason: modelSummary || 'Requirement met.',
            audit_sampled: Math.random() < decision.audit_sample_rate,
        };
    }

    // No overall verdict. Fall back to the score at the extremes only.
    if (score < decision.fail_below) {
        return {
            status: 'failed',
            reason: modelSummary || 'Requirement not met.',
            audit_sampled: false,
        };
    }

    return {
        status: 'review',
        reason: modelSummary || 'Borderline result — needs a human decision.',
        audit_sampled: false,
    };
};
