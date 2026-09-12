import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Global API limiter
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many requests. Please try again after a minute.',
    },
});

// Auth limiter (strict)
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 1 minute.',
    },

    keyGenerator: (req) => {
        // limit by email if exists
        if (req.body?.email) {
            return req.body.email;
        }

        // safe IP handling for IPv6
        return ipKeyGenerator(req.ip || '');
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message:
                'Too many login attempts. Please try again after 1 minute.',
        });
    },
});
// OTP / sensitive actions
export const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: 'Too many OTP requests. Slow down.',
    },
});
