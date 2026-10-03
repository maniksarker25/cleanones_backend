"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const swagger_1 = require("./app/docs/swagger");
// This entry point deliberately has no database, model or business-route imports.
const app = (0, express_1.default)();
const port = Number(process.env.DOCS_PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DOCS_PORT must be an integer between 1 and 65535');
}
// stup
(0, swagger_1.setupSwagger)(app, process.env.DOCS_API_URL || '/api/v1', true);
app.get('/', (_req, res) => res.redirect('/api-docs/'));
app.listen(port, '127.0.0.1', () => {
    console.log('cleanones-backend API documentation: http://localhost:' + port + '/api-docs');
});
