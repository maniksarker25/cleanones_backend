/**
 * Photo AI configuration. Read from process.env directly so the module needs
 * no change to src/app/config. Thresholds are kept here because they change
 * once managers start using the system.
 */

const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined || value === '') return fallback;
    return value === 'true' || value === '1';
};

export const photoAiConfig = {
    /** Off means uploads behave as they did before this module. */
    enabled: bool(process.env.PHOTO_AI_ENABLED, false),

    /** Evaluate and record, but let no verdict influence a decision. */
    shadow_mode: bool(process.env.PHOTO_AI_SHADOW_MODE, true),

    gemini: {
        api_key: process.env.GEMINI_API_KEY ?? '',
        model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
        base_url:
            process.env.GEMINI_BASE_URL ??
            'https://generativelanguage.googleapis.com/v1beta',
        timeout_ms: num(process.env.GEMINI_TIMEOUT_MS, 20000),
        /** Repeat runs used to measure agreement. 1 disables it. */
        samples: num(process.env.GEMINI_SAMPLES, 1),
    },

    /** Gate thresholds. These are measurements, so rejecting on them is safe. */
    gate: {
        min_sharpness: num(process.env.PHOTO_AI_MIN_SHARPNESS, 90),
        min_brightness: num(process.env.PHOTO_AI_MIN_BRIGHTNESS, 32),
        max_brightness: num(process.env.PHOTO_AI_MAX_BRIGHTNESS, 232),
        min_long_edge: num(process.env.PHOTO_AI_MIN_LONG_EDGE, 640),
        /** Hamming distance at or below which two photos count as the same. */
        phash_match_distance: num(process.env.PHOTO_AI_PHASH_DISTANCE, 5),
        /** After this many rejections the photo is accepted and flagged. */
        max_attempts: num(process.env.PHOTO_AI_MAX_ATTEMPTS, 3),
    },

    decision: {
        /** Score at or above which a photo can auto-approve. */
        approve_at_or_above: num(process.env.PHOTO_AI_APPROVE_AT, 75),
        /** Score below which the photo counts as not meeting the brief. */
        fail_below: num(process.env.PHOTO_AI_FAIL_BELOW, 45),
        /** Below this nothing is decided automatically. Tune from real data. */
        review_below_confidence: num(process.env.PHOTO_AI_MIN_CONFIDENCE, 0.6),
        /** Share of auto-approved photos sent to a manager anyway. */
        audit_sample_rate: num(process.env.PHOTO_AI_AUDIT_RATE, 0.05),
    },

    retry: {
        max_attempts: num(process.env.PHOTO_AI_RETRY_ATTEMPTS, 3),
        base_delay_ms: num(process.env.PHOTO_AI_RETRY_DELAY_MS, 1000),
        /** Stop retrying after this long. */
        ceiling_hours: num(process.env.PHOTO_AI_RETRY_CEILING_HOURS, 6),
    },

    /** Long edge to resize to before sending. Drives token cost. */
    image: {
        max_long_edge: num(process.env.PHOTO_AI_IMAGE_LONG_EDGE, 1024),
        jpeg_quality: num(process.env.PHOTO_AI_JPEG_QUALITY, 82),
    },
} as const;

export const isPhotoAiReady = (): boolean =>
    photoAiConfig.enabled && photoAiConfig.gemini.api_key.length > 0;
