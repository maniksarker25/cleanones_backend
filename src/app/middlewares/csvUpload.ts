import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import multer from 'multer';
import AppError from '../error/appError';

const MAX_CSV_BYTES = 2 * 1024 * 1024;

const CSV_MIME_TYPES = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel', // what Windows/Excel reports for .csv
    'text/plain',
    'application/octet-stream',
];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_CSV_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        const isCsv =
            file.originalname.toLowerCase().endsWith('.csv') &&
            CSV_MIME_TYPES.includes(file.mimetype);
        if (isCsv) return cb(null, true);
        cb(new AppError(httpStatus.BAD_REQUEST, 'Only .csv files are allowed'));
    },
});

/** Accepts a single CSV in the "file" field, kept in memory as req.file.buffer. */
const csvUpload = (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (error: unknown) => {
        if (error) {
            if (error instanceof AppError) return next(error);
            if (
                error instanceof multer.MulterError &&
                error.code === 'LIMIT_FILE_SIZE'
            ) {
                return next(
                    new AppError(
                        httpStatus.BAD_REQUEST,
                        'CSV file is too large (maximum 2 MB)'
                    )
                );
            }
            return next(
                new AppError(
                    httpStatus.BAD_REQUEST,
                    'Invalid upload. Send one CSV in the "file" field.'
                )
            );
        }
        if (!req.file) {
            return next(
                new AppError(
                    httpStatus.BAD_REQUEST,
                    'CSV file is required in the "file" field'
                )
            );
        }
        next();
    });
};

export default csvUpload;
