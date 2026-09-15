import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';
import catchAsync from '../utilities/catchasync';

const validateRequest = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
    });
    // Apply the parsed (and, by Zod's default "strip" behavior, unknown-key-
    // stripped) body back onto req.body — otherwise any field that exists on
    // the target Mongoose schema but isn't declared here would still flow
    // through unfiltered (mass assignment). Schemas that don't declare a
    // `body` key at all (e.g. cookie-only ones like refresh-token) are left
    // untouched rather than nulled out.
    if (parsed && typeof parsed === 'object' && 'body' in parsed) {
      req.body = (parsed as { body: unknown }).body;
    }
    return next();
  });
};

export default validateRequest;
