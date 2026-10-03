"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiters = void 0;
const rateLimit_config_1 = require("../config/rateLimit.config");
exports.rateLimiters = {
    apiLimiter: rateLimit_config_1.apiLimiter,
    authLimiter: rateLimit_config_1.authLimiter,
    otpLimiter: rateLimit_config_1.otpLimiter,
};
