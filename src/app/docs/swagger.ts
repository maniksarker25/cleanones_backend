import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { createOpenApiDocument } from './openapi';

export function setupSwagger(
    app: Application,
    serverUrl = '/api/v1',
    preview = false
) {
    if (process.env.DOCS_ENABLED === 'false') return;
    const document = createOpenApiDocument(serverUrl);
    app.get('/api-docs.json', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json(document);
    });
    app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(document, {
            customSiteTitle: 'cleanones-backend API Documentation',
            customCss: '.swagger-ui .topbar { display: none }',
            swaggerOptions: {
                deepLinking: true,
                displayRequestDuration: true,
                filter: true,
                docExpansion: 'none',
                persistAuthorization: false,
                validatorUrl: null,
                withCredentials: true,
                supportedSubmitMethods:
                    preview && !process.env.DOCS_API_URL
                        ? []
                        : ['get', 'post', 'patch', 'delete'],
            },
        })
    );
}
