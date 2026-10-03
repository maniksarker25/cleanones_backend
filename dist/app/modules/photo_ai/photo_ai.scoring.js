"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decide = exports.computeConfidence = exports.computeAgreement = exports.computeCoverage = exports.computeScore = exports.toChecks = void 0;
const photo_ai_config_1 = require("./photo_ai.config");
const toChecks = (response) => response.checks.map((check) => ({
    item: check.item,
    passed: check.passed === 'yes' ? true : check.passed === 'no' ? false : null,
    note: check.note,
}));
exports.toChecks = toChecks;
const computeScore = (checks) => {
    const assessed = checks.filter((check) => check.passed !== null);
    if (assessed.length === 0)
        return null;
    const passed = assessed.filter((check) => check.passed === true);
    return Math.round((passed.length / assessed.length) * 100);
};
exports.computeScore = computeScore;
const computeCoverage = (checks) => {
    if (checks.length === 0)
        return 0;
    const assessed = checks.filter((check) => check.passed !== null);
    return assessed.length / checks.length;
};
exports.computeCoverage = computeCoverage;
const computeAgreement = (scores) => {
    const valid = scores.filter((score) => score !== null);
    if (valid.length < 2)
        return 0.8;
    const mean = valid.reduce((sum, score) => sum + score, 0) / valid.length;
    const variance = valid.reduce((sum, score) => sum + (score - mean) ** 2, 0) / valid.length;
    const spread = Math.sqrt(variance);
    return Math.max(0, Math.min(1, 1 - spread / 40));
};
exports.computeAgreement = computeAgreement;
const computeConfidence = (metrics, coverage, agreement) => {
    const { gate } = photo_ai_config_1.photoAiConfig;
    const sharpnessScore = Math.max(0, Math.min(1, metrics.sharpness / (gate.min_sharpness * 2.5)));
    const midpoint = (gate.min_brightness + gate.max_brightness) / 2;
    const halfBand = (gate.max_brightness - gate.min_brightness) / 2;
    const exposureScore = Math.max(0, Math.min(1, 1 - Math.abs(metrics.brightness - midpoint) / halfBand));
    const imageQuality = 0.5 + 0.5 * (sharpnessScore * 0.6 + exposureScore * 0.4);
    const value = imageQuality * coverage * agreement;
    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
};
exports.computeConfidence = computeConfidence;
const decide = (score, confidence, modelSummary, subjectMatches, requirementMet) => {
    const { decision } = photo_ai_config_1.photoAiConfig;
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
        if (score < decision.approve_at_or_above) {
            return {
                status: 'review',
                reason: modelSummary ||
                    'Overall verdict and individual checks disagree.',
                audit_sampled: false,
            };
        }
        return {
            status: 'passed',
            reason: modelSummary || 'Requirement met.',
            audit_sampled: Math.random() < decision.audit_sample_rate,
        };
    }
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
exports.decide = decide;
