import { Types } from 'mongoose';

/**
 * Photo AI verification types. All added fields are optional so existing
 * shifts stay valid without a migration, and `is_completed` keeps its
 * current meaning.
 */

/** Result of the pre-upload gate. */
export type GateStatus = 'ok' | 'rejected';

/**
 * pending  queued or retrying
 * passed   met the requirement
 * failed   did not meet it
 * review   not confident enough to decide
 * error    evaluation could not complete
 * skipped  gave up, or AI disabled
 */
export type AiStatus =
    | 'pending'
    | 'passed'
    | 'failed'
    | 'review'
    | 'error'
    | 'skipped';

/** One checkable item derived from the requirement. */
export interface IAiCheck {
    item: string;
    /** null means it could not be seen, which is not a failure. */
    passed: boolean | null;
    note?: string;
}

export interface IGateMetrics {
    sharpness: number;
    brightness: number;
    width: number;
    height: number;
}

export interface IGateResult {
    status: GateStatus;
    /** Worker-facing message. Plain instruction, no scores. */
    reason?: string;
    metrics: IGateMetrics;
    /** Stored so a resubmitted photo can be detected later. */
    phash: string;
}

/** Failures come back as a status rather than a throw. */
export interface IAiResult {
    status: AiStatus;
    /** 0-100, computed from the checks, not returned by the model. */
    score: number | null;
    confidence: number | null;
    /** One sentence for the manager. */
    reason: string;
    checks: IAiCheck[];
    /** False when the photo shows a different subject entirely. */
    subject_matches: boolean | null;
    /** Overall verdict. Drives the decision, not the check percentage. */
    requirement_met: boolean | null;
    model: string;
    duration_ms: number;
    /** Set when status is 'error' — the underlying cause, for logs. */
    error?: string;
}

/** Assembled by the caller from the Shift. */
export interface IEvaluationInput {
    photo_url: string;
    requirement: {
        title: string;
        description?: string | null;
        reference_image_url?: string | null;
    };
    context?: {
        room_type?: string;
        cleaning_type?: string;
        room_name?: string;
    };
    /** Past approved examples for this room and title. Two or three is enough. */
    examples?: {
        photo_url: string;
        verdict: 'approved' | 'rejected';
        note?: string;
    }[];
}

/** Fields merged onto a Shift's photo requirement. */
export interface IPhotoAiFields {
    gate_status?: GateStatus;
    gate_reason?: string;
    gate_metrics?: IGateMetrics;
    phash?: string;

    ai_status?: AiStatus;
    ai_score?: number | null;
    ai_confidence?: number | null;
    ai_reason?: string;
    ai_checks?: IAiCheck[];
    ai_subject_matches?: boolean | null;
    ai_requirement_met?: boolean | null;
    ai_model?: string;
    ai_evaluated_at?: Date;
    ai_error?: string;

    /** Gate rejections before this photo was accepted. */
    attempt_count?: number;
    /** Accepted because the retry limit was hit. */
    forced_accept?: boolean;
    /** Pulled into review by the audit sampler despite auto-approving. */
    audit_sampled?: boolean;

    manager_verdict?: 'approved' | 'rejected';
    manager_verdict_by?: Types.ObjectId;
    manager_verdict_at?: Date;
    manager_note?: string;
    /** Set when the 48-hour escalation fired. */
    escalated_at?: Date;
    /** Accepted by the 7-day sweep because nobody reviewed it. */
    auto_accepted?: boolean;
}
