import { Types } from 'mongoose';

export type GateStatus = 'ok' | 'rejected';

export type AiStatus =
    | 'pending'
    | 'passed'
    | 'failed'
    | 'review'
    | 'error'
    | 'skipped';

export interface IAiCheck {
    item: string;

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

    reason?: string;
    metrics: IGateMetrics;

    phash: string;
}

export interface IAiResult {
    status: AiStatus;

    score: number | null;
    confidence: number | null;

    reason: string;
    checks: IAiCheck[];

    subject_matches: boolean | null;

    requirement_met: boolean | null;
    model: string;
    duration_ms: number;

    error?: string;
}

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
        task_name?: string;
    };

    examples?: {
        photo_url: string;
        verdict: 'approved' | 'rejected';
        note?: string;
    }[];
}

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

    attempt_count?: number;

    forced_accept?: boolean;

    audit_sampled?: boolean;

    manager_verdict?: 'approved' | 'rejected';
    manager_verdict_by?: Types.ObjectId;
    manager_verdict_at?: Date;
    manager_note?: string;

    escalated_at?: Date;

    auto_accepted?: boolean;
}
