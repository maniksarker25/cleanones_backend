"use strict";
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
    let errorMessage = 'Something went wrong';
    let errorDetails = {};
    if (err.code === 11000) {
        const match = err.message.match(/"([^"]*)"/);
        const extractedMessage = match && match[1];
        errorMessage = `${extractedMessage} is already exists`;
        statusCode = 400;
    }
    else if (err instanceof zod_1.ZodError) {
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
        errorMessage = `${err.value} is not a valid ID!`;
        // Only the fields a client needs — never the raw CastError (its stack can leak internal paths).
        errorDetails = { path: err.path, value: err.value, kind: err.kind };
    }
    return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        errorDetails,
        // Stack traces leak internal file paths — never send them outside local dev.
        stack: config_1.default.NODE_ENV === 'development' ? (err === null || err === void 0 ? void 0 : err.stack) || null : undefined,
    });
};
exports.default = globalErrorHandler;
