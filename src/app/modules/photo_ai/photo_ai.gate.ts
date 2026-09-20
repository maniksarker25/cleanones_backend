/**
 * Pre-upload checks. Pure measurement over the image pixels, no model and no
 * network call, so the result is repeatable. Runs in ~150ms on a 1024px image.
 */
import sharp, { Sharp } from 'sharp';
import { photoAiConfig } from './photo_ai.config';
import { IGateMetrics, IGateResult } from './photo_ai.interface';

/**
 * Laplacian variance. Sharp images have strong second derivatives at edges;
 * blur smears them and the variance collapses. Note the value is scale
 * dependent, so the 512px resize below and the threshold go together.
 */
const laplacianVariance = async (image: Sharp): Promise<number> => {
    const { data, info } = await image
        .clone()
        .greyscale()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // 4-neighbour Laplacian kernel, interior pixels only.
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const value =
                4 * data[i] -
                data[i - 1] -
                data[i + 1] -
                data[i - width] -
                data[i + width];
            sum += value;
            sumSq += value * value;
            count++;
        }
    }

    if (count === 0) return 0;
    const mean = sum / count;
    return sumSq / count - mean * mean;
};

/**
 * 64-bit dHash. Survives resizing and recompression but changes with the
 * scene, so it catches a resubmitted photo.
 */
const dHash = async (image: Sharp): Promise<string> => {
    const { data } = await image
        .clone()
        .greyscale()
        .resize(9, 8, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Built as hex rather than a BigInt: the project targets below ES2020.
    let hash = '';
    let nibble = 0;
    let bits = 0;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const i = y * 9 + x;
            nibble = (nibble << 1) | (data[i] > data[i + 1] ? 1 : 0);
            bits++;
            if (bits === 4) {
                hash += nibble.toString(16);
                nibble = 0;
                bits = 0;
            }
        }
    }
    return hash;
};

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Hamming distance between two dHash hex strings. Lower means more alike. */
export const hashDistance = (a: string, b: string): number => {
    if (!a || !b || a.length !== b.length) return 64;
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        const left = parseInt(a[i], 16);
        const right = parseInt(b[i], 16);
        if (Number.isNaN(left) || Number.isNaN(right)) return 64;
        distance += NIBBLE_BITS[left ^ right];
    }
    return distance;
};

/**
 * `previousHashes` are the dHashes already stored for this room and title.
 * Omit to skip the reuse check.
 */
export const runGate = async (
    buffer: Buffer,
    previousHashes: string[] = []
): Promise<IGateResult> => {
    const { gate } = photoAiConfig;
    const image = sharp(buffer, { failOn: 'none' });
    const meta = await image.metadata();

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const longEdge = Math.max(width, height);

    const [sharpness, stats, phash] = await Promise.all([
        laplacianVariance(image),
        image.clone().greyscale().stats(),
        dHash(image),
    ]);

    const brightness = stats.channels[0]?.mean ?? 0;

    const metrics: IGateMetrics = {
        sharpness: Math.round(sharpness),
        brightness: Math.round(brightness),
        width,
        height,
    };

    const reject = (reason: string): IGateResult => ({
        status: 'rejected',
        reason,
        metrics,
        phash,
    });

    // Most actionable problem first, so the worker is told one thing to fix.
    if (longEdge < gate.min_long_edge) {
        return reject('Photo resolution is too low. Please retake.');
    }
    if (brightness < gate.min_brightness) {
        return reject('Photo is too dark. Turn on a light and retake.');
    }
    if (brightness > gate.max_brightness) {
        return reject('Photo is too bright. Move away from the light and retake.');
    }
    if (sharpness < gate.min_sharpness) {
        return reject('Photo is blurry. Hold the camera steady and retake.');
    }
    if (
        previousHashes.some(
            (previous) => hashDistance(phash, previous) <= gate.phash_match_distance
        )
    ) {
        return reject('This photo has been submitted before. Take a new one.');
    }

    return { status: 'ok', metrics, phash };
};

/**
 * Downscale and re-encode for the model. Gemini bills 258 tokens per 768px
 * tile, so 1024px costs about a third of 2048px with no useful loss here.
 */
export const prepareForModel = async (buffer: Buffer): Promise<string> => {
    const { image } = photoAiConfig;
    const out = await sharp(buffer, { failOn: 'none' })
        .rotate() // apply EXIF orientation before it is dropped
        .resize(image.max_long_edge, image.max_long_edge, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: image.jpeg_quality })
        .toBuffer();
    return out.toString('base64');
};
