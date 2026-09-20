import axios from 'axios';
import { z } from 'zod';
import { photoAiConfig } from './photo_ai.config';
import { IEvaluationInput } from './photo_ai.interface';
import { RESPONSE_SCHEMA, SYSTEM_INSTRUCTION, buildPrompt } from './photo_ai.prompt';

const modelResponseSchema = z.object({
    subject_matches_title: z.boolean(),
    requirement_met: z.boolean(),
    checks: z
        .array(
            z.object({
                item: z.string(),
                passed: z.enum(['yes', 'no', 'cannot_tell']),
                note: z.string().optional(),
            })
        )
        .min(1),
    summary: z.string(),
});

export type ModelResponse = z.infer<typeof modelResponseSchema>;

interface HttpErrorShape {
    response?: { status?: number };
    code?: string;
}

const asHttpError = (error: unknown): HttpErrorShape =>
    (error && typeof error === 'object' ? error : {}) as HttpErrorShape;

interface GeminiApiResponse {
    candidates?: {
        content?: { parts?: { text?: string }[] };
    }[];
}

export type GeminiOutcome =
    | { ok: true; data: ModelResponse }
    | { ok: false; retryable: boolean; error: string };

const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
        const response = await axios.get<ArrayBuffer>(url, {
            responseType: 'arraybuffer',
            timeout: photoAiConfig.gemini.timeout_ms,
        });
        return Buffer.from(response.data).toString('base64');
    } catch {
        return null;
    }
};

export const evaluateOnce = async (
    input: IEvaluationInput,
    photoBase64: string
): Promise<GeminiOutcome> => {
    const { gemini } = photoAiConfig;

    if (!gemini.api_key) {
        return { ok: false, retryable: false, error: 'GEMINI_API_KEY is not set' };
    }

    const parts: Record<string, unknown>[] = [{ text: buildPrompt(input) }];

    if (input.requirement.reference_image_url) {
        const reference = await fetchImageAsBase64(
            input.requirement.reference_image_url
        );
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
        const response = await axios.post<GeminiApiResponse>(
            `${gemini.base_url}/models/${gemini.model}:generateContent`,
            {
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: RESPONSE_SCHEMA,
                    temperature: 0.2,
                },
            },
            {
                params: { key: gemini.api_key },
                timeout: gemini.timeout_ms,
                headers: { 'content-type': 'application/json' },
            }
        );

        const text =
            response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) {
            return { ok: false, retryable: true, error: 'empty model response' };
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return { ok: false, retryable: true, error: 'model returned invalid JSON' };
        }

        const validated = modelResponseSchema.safeParse(parsed);
        if (!validated.success) {
            return {
                ok: false,
                retryable: true,
                error: `schema mismatch: ${validated.error.issues[0]?.message ?? 'unknown'}`,
            };
        }

        return { ok: true, data: validated.data };
    } catch (error) {
        const httpError = asHttpError(error);
        const status = httpError.response?.status;

        const retryable =
            status === undefined || status === 429 || status >= 500;

        return {
            ok: false,
            retryable,
            error: status
                ? `gemini returned ${status}`
                : httpError.code ?? 'network error',
        };
    }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const evaluateWithRetry = async (
    input: IEvaluationInput,
    photoBase64: string
): Promise<GeminiOutcome> => {
    const { retry } = photoAiConfig;
    let last: GeminiOutcome = {
        ok: false,
        retryable: false,
        error: 'no attempt made',
    };

    for (let attempt = 0; attempt < retry.max_attempts; attempt++) {
        last = await evaluateOnce(input, photoBase64);
        if (last.ok || !last.retryable) return last;
        if (attempt < retry.max_attempts - 1) {
            await sleep(retry.base_delay_ms * Math.pow(2, attempt));
        }
    }
    return last;
};
