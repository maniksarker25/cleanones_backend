"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const multer_1 = __importDefault(require("multer"));
const appError_1 = __importDefault(require("../error/appError"));
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const CSV_MIME_TYPES = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
];
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_CSV_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        const isCsv = file.originalname.toLowerCase().endsWith('.csv') &&
            CSV_MIME_TYPES.includes(file.mimetype);
        if (isCsv)
            return cb(null, true);
        cb(new appError_1.default(http_status_1.default.BAD_REQUEST, 'Only .csv files are allowed'));
    },
});
/** Accepts a single CSV in the "file" field, kept in memory as req.file.buffer. */
const csvUpload = (req, res, next) => {
    upload.single('file')(req, res, (error) => {
        if (error) {
            if (error instanceof appError_1.default)
                return next(error);
            if (error instanceof multer_1.default.MulterError &&
                error.code === 'LIMIT_FILE_SIZE') {
                return next(new appError_1.default(http_status_1.default.BAD_REQUEST, 'CSV file is too large (maximum 2 MB)'));
            }
            return next(new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid upload. Send one CSV in the "file" field.'));
        }
        if (!req.file) {
            return next(new appError_1.default(http_status_1.default.BAD_REQUEST, 'CSV file is required in the "file" field'));
        }
        next();
    });
};
exports.default = csvUpload;
