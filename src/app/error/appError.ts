class AppError extends Error {
  public statusCode: number;
  public details?: unknown;
  constructor(statusCode: number, message: string, stack = '', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
