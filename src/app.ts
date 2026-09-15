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
import router from './app/routes';
import { setupSwagger } from './app/docs/swagger';

import './app/events/listeners';
import './app/modules/shift/shift.cron';
const app: Application = express();
// VERY IMPORTANT (for proxy / nginx)
app.set('trust proxy', 1);

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
            "http://10.10.28.195:3001",
        ],
        credentials: true,
    })
);
app.use('/uploads', express.static('uploads'));
// application routers ----------------

setupSwagger(app);

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
