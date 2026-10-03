import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import AppError from '../error/appError';
import mongoose from 'mongoose';
import config from '../config';

const globalErrorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  next,
) => {
  let statusCode = 500;
  let errorMessage = 'Something went wrong';
  let errorDetails = {};

  if (err.code === 11000) {
    const match = err.message.match(/"([^"]*)"/);
    const extractedMessage = match && match[1];
    errorMessage = `${extractedMessage} is already exists`;
    statusCode = 400;
  } else if (err instanceof ZodError) {
    const concatedMessage = err.issues.map((issue, index) => {
      if (index === err.issues.length - 1) {
        return issue.message;
      } else {
        return issue.message + '.';
      }
    });
    errorMessage = concatedMessage.join(' ') + '.';
    errorDetails = {
      issues: err.issues,
    };
  } else if (err instanceof mongoose.Error.ValidationError) {
    errorMessage = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    errorDetails = err.errors;
    statusCode = 400;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    if (err.details !== undefined) {
      errorDetails = err.details as Record<string, unknown>;
    }
  } else if (err?.name === 'CastError') {
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
    stack: config.NODE_ENV === 'development' ? err?.stack || null : undefined,
  });
};

export default globalErrorHandler;
