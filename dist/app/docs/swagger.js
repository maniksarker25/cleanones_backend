"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = void 0;
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const openapi_1 = require("./openapi");
function setupSwagger(app, serverUrl = '/api/v1', preview = false) {
    if (process.env.DOCS_ENABLED === 'false')
        return;
    const document = (0, openapi_1.createOpenApiDocument)(serverUrl);
    app.get('/api-docs.json', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json(document);
    });
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(document, {
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
            supportedSubmitMethods: preview && !process.env.DOCS_API_URL
                ? []
                : ['get', 'post', 'patch', 'delete'],
        },
    }));
}
exports.setupSwagger = setupSwagger;
