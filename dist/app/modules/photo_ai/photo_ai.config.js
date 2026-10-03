"use strict";
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPhotoAiReady = exports.photoAiConfig = void 0;
const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value, fallback) => {
    if (value === undefined || value === '')
        return fallback;
    return value === 'true' || value === '1';
};
exports.photoAiConfig = {
    enabled: bool(process.env.PHOTO_AI_ENABLED, false),
    shadow_mode: bool(process.env.PHOTO_AI_SHADOW_MODE, true),
    auto_only: bool(process.env.PHOTO_AI_AUTO_ONLY, false),
    gemini: {
        api_key: (_a = process.env.GEMINI_API_KEY) !== null && _a !== void 0 ? _a : '',
        model: (_b = process.env.GEMINI_MODEL) !== null && _b !== void 0 ? _b : 'gemini-3.5-flash-lite',
        base_url: (_c = process.env.GEMINI_BASE_URL) !== null && _c !== void 0 ? _c : 'https://generativelanguage.googleapis.com/v1beta',
        timeout_ms: num(process.env.GEMINI_TIMEOUT_MS, 20000),
        samples: num(process.env.GEMINI_SAMPLES, 1),
    },
    gate: {
        min_sharpness: num(process.env.PHOTO_AI_MIN_SHARPNESS, 90),
        min_brightness: num(process.env.PHOTO_AI_MIN_BRIGHTNESS, 32),
        max_brightness: num(process.env.PHOTO_AI_MAX_BRIGHTNESS, 232),
        min_long_edge: num(process.env.PHOTO_AI_MIN_LONG_EDGE, 640),
        phash_match_distance: num(process.env.PHOTO_AI_PHASH_DISTANCE, 5),
        phash_strict_distance: num(process.env.PHOTO_AI_PHASH_STRICT_DISTANCE, 1),
        max_attempts: num(process.env.PHOTO_AI_MAX_ATTEMPTS, 3),
    },
    decision: {
        approve_at_or_above: num(process.env.PHOTO_AI_APPROVE_AT, 75),
        fail_below: num(process.env.PHOTO_AI_FAIL_BELOW, 45),
        review_below_confidence: num(process.env.PHOTO_AI_MIN_CONFIDENCE, 0.6),
        audit_sample_rate: num(process.env.PHOTO_AI_AUDIT_RATE, 0.05),
    },
    retry: {
        max_attempts: num(process.env.PHOTO_AI_RETRY_ATTEMPTS, 3),
        base_delay_ms: num(process.env.PHOTO_AI_RETRY_DELAY_MS, 1000),
        ceiling_hours: num(process.env.PHOTO_AI_RETRY_CEILING_HOURS, 6),
    },
    image: {
        max_long_edge: num(process.env.PHOTO_AI_IMAGE_LONG_EDGE, 1024),
        jpeg_quality: num(process.env.PHOTO_AI_JPEG_QUALITY, 82),
    },
};
const isPhotoAiReady = () => exports.photoAiConfig.enabled && exports.photoAiConfig.gemini.api_key.length > 0;
exports.isPhotoAiReady = isPhotoAiReady;
