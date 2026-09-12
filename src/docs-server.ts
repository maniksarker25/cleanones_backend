import 'dotenv/config';
import express from 'express';
import { setupSwagger } from './app/docs/swagger';

// This entry point deliberately has no database, model or business-route imports.
const app = express();
const port = Number(process.env.DOCS_PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DOCS_PORT must be an integer between 1 and 65535');
}
setupSwagger(app, process.env.DOCS_API_URL || '/api/v1', true);
app.get('/', (_req, res) => res.redirect('/api-docs/'));
app.listen(port, '127.0.0.1', () => {
    console.log(
        'cleanones-backend API documentation: http://localhost:' + port + '/api-docs'
    );
});
