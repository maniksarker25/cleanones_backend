"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeRowError = exports.splitList = exports.matchOption = exports.compactRow = exports.parseCsvBuffer = exports.MAX_BULK_ROWS = void 0;
const csv_parser_1 = __importDefault(require("csv-parser"));
const http_status_1 = __importDefault(require("http-status"));
const stream_1 = require("stream");
const zod_1 = require("zod");
const appError_1 = __importDefault(require("../error/appError"));
// Each row is created in its own transaction (password hashing included), so keep one request bounded.
// UTF-8 byte order mark that Excel prepends to CSVs; it would otherwise stick to the first header.
const BOM = String.fromCharCode(0xfeff);
exports.MAX_BULK_ROWS = 200;
/**
 * Parses an uploaded CSV into rows keyed by lower-cased header. Values are
 * trimmed, the BOM is stripped, and fully empty rows are dropped.
 * Rejects with a 400 when a required column is missing or the file is too big.
 */
const parseCsvBuffer = (buffer, requiredHeaders) => new Promise((resolve, reject) => {
    const rows = [];
    let failed = false;
    const fail = (error) => {
        if (failed)
            return;
        failed = true;
        reject(error);
    };
    stream_1.Readable.from([buffer])
        .pipe((0, csv_parser_1.default)({
        mapHeaders: ({ header }) => header.replace(BOM, '').trim().toLowerCase(),
        mapValues: ({ value }) => typeof value === 'string' ? value.trim() : value,
    }))
        .on('headers', (headers) => {
        const missing = requiredHeaders.filter((header) => !headers.includes(header));
        if (missing.length) {
            fail(new appError_1.default(http_status_1.default.BAD_REQUEST, `CSV is missing required column(s): ${missing.join(', ')}`));
        }
    })
        .on('data', (row) => {
        if (failed)
            return;
        if (!Object.values(row).some((value) => value !== ''))
            return;
        if (rows.length >= exports.MAX_BULK_ROWS) {
            fail(new appError_1.default(http_status_1.default.BAD_REQUEST, `CSV has too many rows (maximum ${exports.MAX_BULK_ROWS} per upload)`));
            return;
        }
        rows.push(row);
    })
        .on('error', () => fail(new appError_1.default(http_status_1.default.BAD_REQUEST, 'Could not read the CSV file. Check that it is a valid CSV.')))
        .on('end', () => {
        if (failed)
            return;
        if (!rows.length) {
            fail(new appError_1.default(http_status_1.default.BAD_REQUEST, 'CSV has no data rows'));
            return;
        }
        resolve(rows);
    });
});
exports.parseCsvBuffer = parseCsvBuffer;
/** Drops empty cells so optional fields fall back to their defaults. */
const compactRow = (row, keys) => Object.fromEntries(keys
    .filter((key) => row[key] !== undefined && row[key] !== '')
    .map((key) => [key, row[key]]));
exports.compactRow = compactRow;
/** Case-insensitive match against an allowed list; returns the input unchanged if nothing matches. */
const matchOption = (value, options) => {
    var _a;
    return (_a = options.find((option) => option.toLowerCase() === value.toLowerCase())) !== null && _a !== void 0 ? _a : value;
};
exports.matchOption = matchOption;
/** Multi-value cells (languages, working_days) are separated by ";" or "|" since "," splits CSV columns. */
const splitList = (value) => value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
exports.splitList = splitList;
/** "worker_type" -> "Worker type", for CSV column names shown to non-technical users. */
const humanizeField = (path) => path
    .filter((part) => typeof part === 'string')
    .join(' ')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
/** Turns one Zod issue into a plain-language sentence for the upload result screen. */
const describeIssue = (issue) => {
    const field = humanizeField(issue.path);
    const label = field ? `${field}: ` : '';
    switch (issue.code) {
        case 'invalid_enum_value':
            return `${label}"${issue.received}" is not allowed. Please use one of: ${issue.options.join(', ')}.`;
        case 'invalid_type':
            return issue.received === 'undefined'
                ? `${label}this value is required.`
                : `${label}the value is not in the correct format.`;
        case 'too_small':
            if (issue.type === 'string') {
                return issue.minimum === 1
                    ? `${label}this value cannot be empty.`
                    : `${label}must be at least ${issue.minimum} characters long.`;
            }
            return `${label}the value is too small.`;
        case 'too_big':
            return issue.type === 'string'
                ? `${label}must be at most ${issue.maximum} characters long.`
                : `${label}the value is too large.`;
        case 'invalid_string':
            return issue.validation === 'email'
                ? `${label}please enter a valid email address.`
                : `${label}the value is not in the correct format.`;
        default:
            return `${label}${issue.message}`;
    }
};
/** One readable line per failed row. */
const describeRowError = (error) => {
    if (error instanceof zod_1.ZodError) {
        return error.issues.map(describeIssue).join(' ');
    }
    if (error instanceof Error)
        return error.message;
    return 'Unknown error';
};
exports.describeRowError = describeRowError;
