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
exports.prepareForModel = exports.runGate = exports.hashDistance = void 0;
const sharp_1 = __importDefault(require("sharp"));
const photo_ai_config_1 = require("./photo_ai.config");
const laplacianVariance = (image) => __awaiter(void 0, void 0, void 0, function* () {
    const { data, info } = yield image
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
            const value = 4 * data[i] -
                data[i - 1] -
                data[i + 1] -
                data[i - width] -
                data[i + width];
            sum += value;
            sumSq += value * value;
            count++;
        }
    }
    if (count === 0)
        return 0;
    const mean = sum / count;
    return sumSq / count - mean * mean;
});
const dHash = (image) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield image
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
});
const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
const hashDistance = (a, b) => {
    if (!a || !b || a.length !== b.length)
        return 64;
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        const left = parseInt(a[i], 16);
        const right = parseInt(b[i], 16);
        if (Number.isNaN(left) || Number.isNaN(right))
            return 64;
        distance += NIBBLE_BITS[left ^ right];
    }
    return distance;
};
exports.hashDistance = hashDistance;
const runGate = (buffer, previous = []) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const { gate } = photo_ai_config_1.photoAiConfig;
    const image = (0, sharp_1.default)(buffer, { failOn: 'none' });
    const meta = yield image.metadata();
    const width = (_a = meta.width) !== null && _a !== void 0 ? _a : 0;
    const height = (_b = meta.height) !== null && _b !== void 0 ? _b : 0;
    const longEdge = Math.max(width, height);
    const [sharpness, stats, phash] = yield Promise.all([
        laplacianVariance(image),
        image.clone().greyscale().stats(),
        dHash(image),
    ]);
    const brightness = (_d = (_c = stats.channels[0]) === null || _c === void 0 ? void 0 : _c.mean) !== null && _d !== void 0 ? _d : 0;
    const metrics = {
        sharpness: Math.round(sharpness),
        brightness: Math.round(brightness),
        width,
        height,
    };
    const reject = (reason) => ({
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
    const candidates = Array.isArray(previous)
        ? { sameShift: previous }
        : previous;
    if (((_e = candidates.sameShift) !== null && _e !== void 0 ? _e : []).some((h) => (0, exports.hashDistance)(phash, h) <= gate.phash_match_distance)) {
        return reject('This photo was already used for another item. Take a new one.');
    }
    if (((_f = candidates.otherShifts) !== null && _f !== void 0 ? _f : []).some((h) => (0, exports.hashDistance)(phash, h) <= gate.phash_strict_distance)) {
        return reject('This photo was submitted on an earlier day. Take a new one.');
    }
    return { status: 'ok', metrics, phash };
});
exports.runGate = runGate;
const prepareForModel = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    const { image } = photo_ai_config_1.photoAiConfig;
    const out = yield (0, sharp_1.default)(buffer, { failOn: 'none' })
        .rotate()
        .resize(image.max_long_edge, image.max_long_edge, {
        fit: 'inside',
        withoutEnlargement: true,
    })
        .jpeg({ quality: image.jpeg_quality })
        .toBuffer();
    return out.toString('base64');
});
exports.prepareForModel = prepareForModel;
