"use strict";
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { ErrorRequestHandler } from 'express';
// import { ZodError } from 'zod';
// import config from '../config';
// import handleZodError from '../error/handleZodError';
// import { TErrorSources } from '../interface/error.interface';
// import handleValidationError from '../error/handleValidationError';
// import handleCastError from '../error/handleCastError';
// import handleDuplicateError from '../error/handleDuplicateError';
// import AppError from '../error/appError';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const appError_1 = __importDefault(require("../error/appError"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const globalErrorHandler = (err, req, res, 
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
next) => {
    let statusCode = 500;
    // let message = 'Something went wrong';
    let errorMessage = 'Something went wrong';
    let errorDetails = {};
    if (err.code === 11000) {
        // message = 'Duplicate Error';
        const match = err.message.match(/"([^"]*)"/);
        const extractedMessage = match && match[1];
        errorMessage = `${extractedMessage} is already exists`;
        statusCode = 400;
    }
    else if (err instanceof zod_1.ZodError) {
        // message = 'Validation Error';
        const concatedMessage = err.issues.map((issue, index) => {
            if (index === err.issues.length - 1) {
                return issue.message;
            }
            else {
                return issue.message + '.';
            }
        });
        errorMessage = concatedMessage.join(' ') + '.';
        errorDetails = {
            issues: err.issues,
        };
    }
    else if (err instanceof mongoose_1.default.Error.ValidationError) {
        // message = 'Mongoose Validation Error';
        errorMessage = Object.values(err.errors)
            .map((val) => val.message)
            .join(', ');
        errorDetails = err.errors;
        statusCode = 400;
    }
    else if (err instanceof appError_1.default) {
        statusCode = err.statusCode;
        errorMessage = err.message;
        if (err.details !== undefined) {
            errorDetails = err.details;
        }
    }
    else if ((err === null || err === void 0 ? void 0 : err.name) === 'CastError') {
        statusCode = 400;
        // message = 'Invalid ID';
        errorMessage = `${err.value} is not a valid ID!`;
        // Only the fields a client actually needs to see which field/value was
        // invalid — never the raw CastError (its `.reason`/stack chain can
        // include internal values and file paths).
        errorDetails = { path: err.path, value: err.value, kind: err.kind };
    }
    return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        // errorMessage: errorMessage,
        errorDetails,
        // Stack traces reveal internal file paths/module structure — never send
        // them outside local development.
        stack: config_1.default.NODE_ENV === 'development' ? (err === null || err === void 0 ? void 0 : err.stack) || null : undefined,
        // err,
    });
};
exports.default = globalErrorHandler;
