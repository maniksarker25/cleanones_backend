import {
    apiLimiter,
    authLimiter,
    otpLimiter,
} from '../config/rateLimit.config';

export const rateLimiters = {
    apiLimiter,
    authLimiter,
    otpLimiter,
};
