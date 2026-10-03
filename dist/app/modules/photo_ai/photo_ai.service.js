"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoAiService = exports.aiResultToFields = exports.gateResultToFields = exports.evaluatePhoto = exports.checkPhotoByUrl = exports.checkPhoto = void 0;
const axios_1 = __importDefault(require("axios"));
const photo_ai_config_1 = require("./photo_ai.config");
const photo_ai_gate_1 = require("./photo_ai.gate");
const photo_ai_gemini_1 = require("./photo_ai.gemini");
const photo_ai_scoring_1 = require("./photo_ai.scoring");
const checkPhoto = (buffer, previous = []) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield (0, photo_ai_gate_1.runGate)(buffer, previous);
    }
    catch (_a) {
        return {
            status: 'ok',
            metrics: { sharpness: 0, brightness: 0, width: 0, height: 0 },
            phash: '',
        };
    }
});
exports.checkPhoto = checkPhoto;
const checkPhotoByUrl = (photoUrl, previous = []) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(photoUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
        });
        return yield (0, exports.checkPhoto)(Buffer.from(response.data), previous);
    }
    catch (_b) {
        return {
            status: 'ok',
            metrics: { sharpness: 0, brightness: 0, width: 0, height: 0 },
            phash: '',
        };
    }
});
exports.checkPhotoByUrl = checkPhotoByUrl;
const fail = (status, reason, started, error) => ({
    status,
    score: null,
    confidence: null,
    reason,
    checks: [],
    subject_matches: null,
    requirement_met: null,
    model: photo_ai_config_1.photoAiConfig.gemini.model,
    duration_ms: Date.now() - started,
    error,
});
const evaluatePhoto = (input, photoBuffer) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const started = Date.now();
    if (!(0, photo_ai_config_1.isPhotoAiReady)()) {
        return fail('skipped', 'AI verification is not enabled.', started);
    }
    let buffer = photoBuffer;
    if (!buffer) {
        try {
            const response = yield axios_1.default.get(input.photo_url, {
                responseType: 'arraybuffer',
                timeout: photo_ai_config_1.photoAiConfig.gemini.timeout_ms,
            });
            buffer = Buffer.from(response.data);
        }
        catch (_d) {
            return fail('error', 'Could not read the uploaded photo.', started, 'photo fetch failed');
        }
    }
    let photoBase64;
    try {
        photoBase64 = yield (0, photo_ai_gate_1.prepareForModel)(buffer);
    }
    catch (_e) {
        return fail('error', 'Photo could not be processed.', started, 'resize failed');
    }
    const samples = Math.max(1, photo_ai_config_1.photoAiConfig.gemini.samples);
    const outcomes = yield Promise.all(Array.from({ length: samples }, () => (0, photo_ai_gemini_1.evaluateWithRetry)(input, photoBase64)));
    const successful = outcomes.filter((outcome) => outcome.ok);
    if (successful.length === 0) {
        const firstFailure = outcomes.find((outcome) => !outcome.ok);
        return fail((firstFailure === null || firstFailure === void 0 ? void 0 : firstFailure.retryable) ? 'pending' : 'error', 'Automatic check unavailable — a manager will review.', started, (_c = firstFailure === null || firstFailure === void 0 ? void 0 : firstFailure.error) !== null && _c !== void 0 ? _c : 'unknown');
    }
    const primary = successful[0].data;
    const checks = (0, photo_ai_scoring_1.toChecks)(primary);
    const score = (0, photo_ai_scoring_1.computeScore)(checks);
    const coverage = (0, photo_ai_scoring_1.computeCoverage)(checks);
    const agreement = (0, photo_ai_scoring_1.computeAgreement)(successful.map((outcome) => (0, photo_ai_scoring_1.computeScore)((0, photo_ai_scoring_1.toChecks)(outcome.data))));
    const gateMetrics = yield (0, photo_ai_gate_1.runGate)(buffer)
        .then((result) => result.metrics)
        .catch(() => ({ sharpness: 0, brightness: 0, width: 0, height: 0 }));
    const confidence = (0, photo_ai_scoring_1.computeConfidence)(gateMetrics, coverage, agreement);
    const outcome = (0, photo_ai_scoring_1.decide)(score, confidence, primary.summary, primary.subject_matches_title, primary.requirement_met);
    return {
        status: outcome.status,
        score,
        confidence,
        reason: outcome.reason,
        checks,
        subject_matches: primary.subject_matches_title,
        requirement_met: primary.requirement_met,
        model: photo_ai_config_1.photoAiConfig.gemini.model,
        duration_ms: Date.now() - started,
    };
});
exports.evaluatePhoto = evaluatePhoto;
const gateResultToFields = (result) => ({
    gate_status: result.status,
    gate_reason: result.reason,
    gate_metrics: result.metrics,
    phash: result.phash,
});
exports.gateResultToFields = gateResultToFields;
const resolveStatus = (result) => {
    if (photo_ai_config_1.photoAiConfig.shadow_mode) {
        return result.status === 'passed' || result.status === 'failed'
            ? 'review'
            : result.status;
    }
    if (photo_ai_config_1.photoAiConfig.auto_only && result.status !== 'failed') {
        return 'passed';
    }
    return result.status;
};
const aiResultToFields = (result) => (Object.assign(Object.assign({ ai_status: resolveStatus(result) }, (photo_ai_config_1.photoAiConfig.auto_only && !photo_ai_config_1.photoAiConfig.shadow_mode
    ? {
        auto_decided: true,
        auto_decision: (result.status === 'failed'
            ? 'rejected'
            : 'approved'),
        auto_decided_at: new Date(),
    }
    : {})), { ai_score: result.score, ai_confidence: result.confidence, ai_reason: result.reason, ai_checks: result.checks, ai_subject_matches: result.subject_matches, ai_requirement_met: result.requirement_met, ai_model: result.model, ai_evaluated_at: new Date(), ai_error: result.error }));
exports.aiResultToFields = aiResultToFields;
exports.PhotoAiService = {
    checkPhoto: exports.checkPhoto,
    checkPhotoByUrl: exports.checkPhotoByUrl,
    evaluatePhoto: exports.evaluatePhoto,
    gateResultToFields: exports.gateResultToFields,
    aiResultToFields: exports.aiResultToFields,
};
