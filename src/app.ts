/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'crypto';
import express, { Application } from 'express';
import sendContactUsEmail from './app/helper/sendContactUsEmail';

import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { rateLimiters } from './app/middlewares/rateLimiter.middleware';
import PersonaController from './app/modules/persona/persona.controller';
import router from './app/routes';

import './app/events/listeners';
const app: Application = express();
// VERY IMPORTANT (for proxy / nginx)
app.set('trust proxy', 1);

// ✅ ADD THIS — before express.json()
app.post(
    '/api/v1/persona/webhook',
    express.raw({ type: 'application/json' }),
    (req: any, _res: any, next: any) => {
        console.log('[App] Is Buffer:', Buffer.isBuffer(req.body)); // must print true
        if (Buffer.isBuffer(req.body)) {
            req.rawBody = req.body;
            req.body = JSON.parse(req.body.toString());
        }
        next();
    },
    PersonaController.handlePersonaWebhook
);
// parser----------------
app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: [
            'http://localhost:3007',
            'http://localhost:3008',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://10.10.20.48:3000',
            'http://localhost:9090',
            'http://10.10.20.43:9090',
        ],
        credentials: true,
    })
);
app.use('/uploads', express.static('uploads'));
// application routers ----------------

app.use(rateLimiters.apiLimiter);
app.use('/api/v1', router);
app.post('/contact-us', sendContactUsEmail);

app.get('/', async (req, res) => {
    res.send({ message: 'nice to meet you 2' });
});

export function generateSignature(
    partnerId: string,
    apiKey: string,
    timestamp: string
) {
    const hmac = crypto.createHmac('sha256', apiKey);
    hmac.update(partnerId + timestamp);
    return hmac.digest('base64');
}

// global error handler
app.use(globalErrorHandler);
// not found
app.use(notFound);

export default app;
