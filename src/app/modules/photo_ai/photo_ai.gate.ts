import sharp, { Sharp } from 'sharp';
import { photoAiConfig } from './photo_ai.config';
import { IGateMetrics, IGateResult } from './photo_ai.interface';

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

const dHash = async (image: Sharp): Promise<string> => {
    const { data } = await image
        .clone()
        .greyscale()
        .resize(9, 8, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

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

export const prepareForModel = async (buffer: Buffer): Promise<string> => {
    const { image } = photoAiConfig;
    const out = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(image.max_long_edge, image.max_long_edge, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: image.jpeg_quality })
        .toBuffer();
    return out.toString('base64');
};
