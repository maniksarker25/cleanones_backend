"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignature = void 0;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const sendContactUsEmail_1 = __importDefault(require("./app/helper/sendContactUsEmail"));
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const notFound_1 = __importDefault(require("./app/middlewares/notFound"));
const rateLimiter_middleware_1 = require("./app/middlewares/rateLimiter.middleware");
const routes_1 = __importDefault(require("./app/routes"));
const swagger_1 = require("./app/docs/swagger");
require("./app/events/listeners");
const app = (0, express_1.default)();
// VERY IMPORTANT (for proxy / nginx)
app.set('trust proxy', 1);
// security headers ----------------
app.use((0, helmet_1.default)({
    // This API's real clients (mobile/web apps) only ever consume JSON.
    // The one HTML page it renders itself is Swagger UI (/api-docs),
    // which injects inline scripts/styles that a default CSP blocks —
    // tuning CSP just for that one docs page isn't worth it, so CSP
    // stays off here while every other helmet header (frameguard,
    // nosniff, HSTS, referrer-policy, hidePoweredBy, etc.) still applies.
    contentSecurityPolicy: false,
    // Uploaded photos (/uploads) are loaded cross-origin by every
    // frontend in the CORS allowlist below (the vercel.app domains) —
    // helmet's default 'same-origin' resource policy would make
    // browsers block those image loads.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// parser----------------
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3007',
        'http://localhost:3008',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://10.10.20.48:3000',
        'http://localhost:9090',
        'http://10.10.20.43:9090',
        "http://10.10.28.195:3001",
        "http://10.10.28.119:3001",
        "http://10.10.28.194:3003",
        "http://10.10.28.194:3001",
        "https://cleanones.vercel.app",
        "https://cleanones-client-portal.vercel.app",
        "https://cleanones-admin-testing.vercel.app",
        "https://cleanones-client-testing.vercel.app"
    ],
    credentials: true,
}));
app.use('/uploads', express_1.default.static('uploads'));
// application routers ----------------
(0, swagger_1.setupSwagger)(app);
app.use('/api/v1', rateLimiter_middleware_1.rateLimiters.apiLimiter, routes_1.default);
app.post('/contact-us', sendContactUsEmail_1.default);
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send({ message: 'nice to meet you 2' });
}));
function generateSignature(partnerId, apiKey, timestamp) {
    const hmac = crypto_1.default.createHmac('sha256', apiKey);
    hmac.update(partnerId + timestamp);
    return hmac.digest('base64');
}
exports.generateSignature = generateSignature;
// global error handler
app.use(globalErrorHandler_1.default);
// not found
app.use(notFound_1.default);
exports.default = app;
