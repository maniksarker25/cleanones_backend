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
exports.evaluateWithRetry = exports.evaluateOnce = void 0;
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const photo_ai_config_1 = require("./photo_ai.config");
const photo_ai_prompt_1 = require("./photo_ai.prompt");
const modelResponseSchema = zod_1.z.object({
    subject_matches_title: zod_1.z.boolean(),
    requirement_met: zod_1.z.boolean(),
    checks: zod_1.z
        .array(zod_1.z.object({
        item: zod_1.z.string(),
        passed: zod_1.z.enum(['yes', 'no', 'cannot_tell']),
        note: zod_1.z.string().optional(),
    }))
        .min(1),
    summary: zod_1.z.string(),
});
const asHttpError = (error) => (error && typeof error === 'object' ? error : {});
const fetchImageAsBase64 = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: photo_ai_config_1.photoAiConfig.gemini.timeout_ms,
        });
        return Buffer.from(response.data).toString('base64');
    }
    catch (_a) {
        return null;
    }
});
const evaluateOnce = (input, photoBase64) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const { gemini } = photo_ai_config_1.photoAiConfig;
    if (!gemini.api_key) {
        return { ok: false, retryable: false, error: 'GEMINI_API_KEY is not set' };
    }
    const parts = [{ text: (0, photo_ai_prompt_1.buildPrompt)(input) }];
    if (input.requirement.reference_image_url) {
        const reference = yield fetchImageAsBase64(input.requirement.reference_image_url);
        if (reference) {
            parts.push({ text: 'REFERENCE PHOTO (the approved standard):' });
            parts.push({
                inline_data: { mime_type: 'image/jpeg', data: reference },
            });
        }
    }
    parts.push({ text: 'SUBMITTED PHOTO:' });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: photoBase64 } });
    try {
        const response = yield axios_1.default.post(`${gemini.base_url}/models/${gemini.model}:generateContent`, {
            systemInstruction: { parts: [{ text: photo_ai_prompt_1.SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: photo_ai_prompt_1.RESPONSE_SCHEMA,
                temperature: 0.2,
            },
        }, {
            params: { key: gemini.api_key },
            timeout: gemini.timeout_ms,
            headers: { 'content-type': 'application/json' },
        });
        const text = (_h = (_g = (_f = (_e = (_d = (_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.candidates) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.parts) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.text) !== null && _h !== void 0 ? _h : '';
        if (!text) {
            return { ok: false, retryable: true, error: 'empty model response' };
        }
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch (_o) {
            return { ok: false, retryable: true, error: 'model returned invalid JSON' };
        }
        const validated = modelResponseSchema.safeParse(parsed);
        if (!validated.success) {
            return {
                ok: false,
                retryable: true,
                error: `schema mismatch: ${(_k = (_j = validated.error.issues[0]) === null || _j === void 0 ? void 0 : _j.message) !== null && _k !== void 0 ? _k : 'unknown'}`,
            };
        }
        return { ok: true, data: validated.data };
    }
    catch (error) {
        const httpError = asHttpError(error);
        const status = (_l = httpError.response) === null || _l === void 0 ? void 0 : _l.status;
        const retryable = status === undefined || status === 429 || status >= 500;
        return {
            ok: false,
            retryable,
            error: status
                ? `gemini returned ${status}`
                : (_m = httpError.code) !== null && _m !== void 0 ? _m : 'network error',
        };
    }
});
exports.evaluateOnce = evaluateOnce;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluateWithRetry = (input, photoBase64) => __awaiter(void 0, void 0, void 0, function* () {
    const { retry } = photo_ai_config_1.photoAiConfig;
    let last = {
        ok: false,
        retryable: false,
        error: 'no attempt made',
    };
    for (let attempt = 0; attempt < retry.max_attempts; attempt++) {
        last = yield (0, exports.evaluateOnce)(input, photoBase64);
        if (last.ok || !last.retryable)
            return last;
        if (attempt < retry.max_attempts - 1) {
            yield sleep(retry.base_delay_ms * Math.pow(2, attempt));
        }
    }
    return last;
});
exports.evaluateWithRetry = evaluateWithRetry;
