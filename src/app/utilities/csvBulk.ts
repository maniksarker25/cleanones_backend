import csvParser from 'csv-parser';
import httpStatus from 'http-status';
import { Readable } from 'stream';
import { ZodError } from 'zod';
import AppError from '../error/appError';

// Each row is created in its own transaction (password hashing included), so keep one request bounded.
// UTF-8 byte order mark that Excel prepends to CSVs; it would otherwise stick to the first header.
const BOM = String.fromCharCode(0xfeff);

export const MAX_BULK_ROWS = 200;

export interface BulkRowFailure {
    row: number;
    email?: string;
    error: string;
}

export interface BulkCreatedRow {
    row: number;
    email: string;
    id: string;
}

export interface BulkResult {
    total: number;
    created_count: number;
    failed_count: number;
    created: BulkCreatedRow[];
    failed: BulkRowFailure[];
}

/**
 * Parses an uploaded CSV into rows keyed by lower-cased header. Values are
 * trimmed, the BOM is stripped, and fully empty rows are dropped.
 * Rejects with a 400 when a required column is missing or the file is too big.
 */
export const parseCsvBuffer = (
    buffer: Buffer,
    requiredHeaders: string[]
): Promise<Record<string, string>[]> =>
    new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];
        let failed = false;
        const fail = (error: Error) => {
            if (failed) return;
            failed = true;
            reject(error);
        };

        Readable.from([buffer])
            .pipe(
                csvParser({
                    mapHeaders: ({ header }) =>
                        header.replace(BOM, '').trim().toLowerCase(),
                    mapValues: ({ value }) =>
                        typeof value === 'string' ? value.trim() : value,
                })
            )
            .on('headers', (headers: string[]) => {
                const missing = requiredHeaders.filter(
                    (header) => !headers.includes(header)
                );
                if (missing.length) {
                    fail(
                        new AppError(
                            httpStatus.BAD_REQUEST,
                            `CSV is missing required column(s): ${missing.join(', ')}`
                        )
                    );
                }
            })
            .on('data', (row: Record<string, string>) => {
                if (failed) return;
                if (!Object.values(row).some((value) => value !== '')) return;
                if (rows.length >= MAX_BULK_ROWS) {
                    fail(
                        new AppError(
                            httpStatus.BAD_REQUEST,
                            `CSV has too many rows (maximum ${MAX_BULK_ROWS} per upload)`
                        )
                    );
                    return;
                }
                rows.push(row);
            })
            .on('error', () =>
                fail(
                    new AppError(
                        httpStatus.BAD_REQUEST,
                        'Could not read the CSV file. Check that it is a valid CSV.'
                    )
                )
            )
            .on('end', () => {
                if (failed) return;
                if (!rows.length) {
                    fail(
                        new AppError(
                            httpStatus.BAD_REQUEST,
                            'CSV has no data rows'
                        )
                    );
                    return;
                }
                resolve(rows);
            });
    });

/** Drops empty cells so optional fields fall back to their defaults. */
export const compactRow = (row: Record<string, string>, keys: string[]) =>
    Object.fromEntries(
        keys
            .filter((key) => row[key] !== undefined && row[key] !== '')
            .map((key) => [key, row[key]])
    ) as Record<string, string>;

/** Case-insensitive match against an allowed list; returns the input unchanged if nothing matches. */
export const matchOption = (value: string, options: readonly string[]) =>
    options.find((option) => option.toLowerCase() === value.toLowerCase()) ??
    value;

/** Multi-value cells (languages, working_days) are separated by ";" or "|" since "," splits CSV columns. */
export const splitList = (value: string) =>
    value
        .split(/[;|]/)
        .map((item) => item.trim())
        .filter(Boolean);

/** "worker_type" -> "Worker type", for CSV column names shown to non-technical users. */
const humanizeField = (path: (string | number)[]) =>
    path
        .filter((part) => typeof part === 'string')
        .join(' ')
        .replace(/_/g, ' ')
        .replace(/^./, (c) => c.toUpperCase());

/** Turns one Zod issue into a plain-language sentence for the upload result screen. */
const describeIssue = (issue: ZodError['issues'][number]): string => {
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
export const describeRowError = (error: unknown): string => {
    if (error instanceof ZodError) {
        return error.issues.map(describeIssue).join(' ');
    }
    if (error instanceof Error) return error.message;
    return 'Unknown error';
};
