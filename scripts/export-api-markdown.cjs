const fs = require('node:fs');
const path = require('node:path');
require('ts-node/register/transpile-only');
const { createOpenApiDocument } = require('../src/app/docs/openapi');

const document = createOpenApiDocument();
const lines = [];
const write = (...text) => lines.push(...text, '');
const anchor = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const resolve = (schema = {}) => schema.$ref
    ? document.components.schemas[schema.$ref.split('/').pop()]
    : schema;

function type(schema = {}) {
    if (schema.$ref) {
        const name = schema.$ref.split('/').pop();
        return `[${name}](#schema-${anchor(name)})`;
    }
    if (schema.enum?.length === 1 && schema.enum[0] === null) return 'null';
    if (schema.oneOf || schema.allOf) {
        return (schema.oneOf || schema.allOf).map(type).join(schema.oneOf ? ' or ' : ' + ')
            + (schema.nullable ? ' or null' : '');
    }
    return (schema.type === 'array' ? `array of ${type(schema.items)}` : schema.type || 'any')
        + (schema.format ? ` (${schema.format})` : '')
        + (schema.nullable ? ' or null' : '');
}

function notes(schema = {}) {
    const parts = [schema.description || ''];
    if (schema.enum) parts.push(`Allowed: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}.`);
    if (schema.default !== undefined) parts.push(`Default: ${JSON.stringify(schema.default)}.`);
    for (const key of ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'pattern']) {
        if (schema[key] !== undefined) parts.push(`${key}: ${schema[key]}.`);
    }
    if (schema.exclusiveMinimum) parts.push('Minimum is exclusive.');
    if (schema.readOnly) parts.push('Read only.');
    if (schema.items) parts.push('Each item: ' + notes(resolve(schema.items)));
    return parts.filter(Boolean).join(' ');
}

function fields(schema, prefix = '', depth = 0) {
    schema = resolve(schema);
    if (schema.allOf) return schema.allOf.flatMap(s => fields(s, prefix, depth));
    return Object.entries(schema.properties || {}).flatMap(([name, value]) => {
        const label = prefix + name;
        const rows = [`| \`${label}\` | ${type(value)} | ${schema.required?.includes(name) ? 'Yes' : 'No'} | ${cell(notes(value))} |`];
        if (depth < 3 && !value.$ref && value.properties) rows.push(...fields(value, label + '.', depth + 1));
        return rows;
    });
}

function fieldTable(schema) {
    const rows = fields(schema);
    if (rows.length) write('| Field | Type | Required | Details |', '| --- | --- | --- | --- |', ...rows);
    else write(`Type: ${type(schema)}.`);
}

function example(schema = {}, key = '', depth = 0) {
    schema = resolve(schema);
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (schema.enum) return schema.enum[0];
    if (schema.oneOf) return example(schema.oneOf[0], key, depth + 1);
    if (schema.allOf) return Object.assign({}, ...schema.allOf.map(s => example(s, key, depth + 1)));
    if (schema.format === 'binary') return '<choose a file>';
    if (schema.format === 'date-time') return '2026-09-12T09:00:00.000Z';
    if (schema.format === 'password') return 'ExamplePass123!';
    if (schema.format === 'email' || /email/i.test(key)) return 'user@example.com';
    if (schema.type === 'array') return [example(schema.items, key, depth + 1)];
    if (schema.type === 'boolean') return true;
    if (schema.type === 'number' || schema.type === 'integer') return schema.minimum ?? 1;
    if (schema.type === 'object') {
        if (depth > 5) return {};
        return Object.fromEntries(Object.entries(schema.properties || {})
            .filter(([name, value]) => !value.readOnly && (!schema.required || schema.required.includes(name) || value.example !== undefined))
            .map(([name, value]) => [name, example(value, name, depth + 1)]));
    }
    return 'example';
}

const operationCount = Object.values(document.paths).reduce((count, item) => count + Object.keys(item).length, 0);
write('# cleanones-backend API reference', `${operationCount} documented operations from the implemented, mounted API handlers. This snapshot describes the current unfinished backend; documented contracts are not a claim that every endpoint works end to end.`);
write('## Connection and authentication', '- Base URL: `http://localhost:<BACKEND_PORT>/api/v1` (replace with your deployed backend URL).', '- JSON requests: `Content-Type: application/json`.', '- Protected requests: `Authorization: Bearer <accessToken>`.', '- Log in using a verified, active account and use `data.accessToken`.', '- Refresh requests use the `refreshToken` HttpOnly cookie set by login; no JSON body is needed.', '- Standalone Swagger at `http://localhost:3001/api-docs` serves documentation only. It is not the API server.');
write('## Current implementation limitations', 'Manager and admin authentication profile lookups are unfinished, so protected calls can fail before the controller runs. User and super-admin modules still have missing dependencies. Zod validation failures currently return HTTP 500. Other operation-specific limitations are listed below.', 'Excluded: unfinished user/super-admin routes, the placeholder earnings chart, unmounted conversation/message/support routers, and empty testimonial routes. Root/static routes and the separate contact email helper are outside this versioned reference.');
write('## Common response and errors', 'Successful operations below return HTTP 200, including creates and deletes. A typical envelope is:', '```json', JSON.stringify({ success: true, message: 'Operation completed successfully', data: {} }, null, 2), '```', 'The `data` schema is listed per operation. For paginated lists, metadata and rows are under `data.meta` and `data.result`. Some legacy branches omit `data` or return null as noted. A response schema field marked optional is not guaranteed to be returned.', '| HTTP status | Meaning |', '| --- | --- |', '| 400 | Invalid ID, model validation, or business-rule failure. |', '| 401 | Missing/invalid/expired access token or role not allowed. |', '| 403 | Blocked/inactive account or rejected credentials. |', '| 404 | Resource or authenticated profile not found. |', '| 429 | Rate limit exceeded; respect Retry-After. |', '| 500 | Server error; currently also used for Zod validation failures. |', 'Errors contain `success: false` and `message`; the global handler also includes `errorDetails` and `stack`. Rate-limit errors may include only success and message.', 'Global limit: 60 requests/minute per IP. Sensitive authentication routes share 3 requests/minute per email or IP.');
write('## Workflow', 'Create a client, then its location, then a room, then tasks. Weekly tasks need a nonempty `days_of_week`; monthly tasks need a nonempty `days_of_month`. Password recovery: request reset code, verify it, then reset the password. All examples are illustrative; replace IDs and credentials with your own.');
write('## Endpoint index', '| Method | Endpoint (relative to /api/v1) | Access | Section |', '| --- | --- | --- | --- |');
lines.pop(); // Keep the header and endpoint rows in one Markdown table.
for (const [url, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
        const access = operation['x-roles']?.join(', ') || (operation.security?.some(s => s.refreshCookie) ? 'refreshToken cookie' : 'Public');
        lines.push(`| ${method.toUpperCase()} | \`${url}\` | ${access} | [${operation.summary}](#${anchor(operation.operationId)}) |`);
    }
}
lines.push('');
for (const tag of document.tags) {
    write(`## ${tag.name}`, tag.description);
    for (const [url, item] of Object.entries(document.paths)) {
        for (const [method, operation] of Object.entries(item)) {
            if (!operation.tags.includes(tag.name)) continue;
            write(`<a id="${anchor(operation.operationId)}"></a>`, `### ${method.toUpperCase()} ${url}`, operation.summary, operation.description);
            write(`**Access:** ${operation['x-roles']?.join(', ') || (operation.security?.some(s => s.refreshCookie) ? 'refreshToken cookie' : 'Public (no route-level authentication)')}.`);
            if (operation.parameters?.length) {
                write('**Parameters**', '| Name | In | Type | Required | Details |', '| --- | --- | --- | --- | --- |', ...operation.parameters.map(p => `| \`${p.name}\` | ${p.in} | ${type(p.schema)} | ${p.required ? 'Yes' : 'No'} | ${cell([p.description, notes(p.schema)].filter(Boolean).join(' '))} |`));
            }
            if (operation.requestBody) {
                for (const [media, content] of Object.entries(operation.requestBody.content)) {
                    write(`**Request: ${media}**`, notes(resolve(content.schema)));
                    fieldTable(content.schema);
                    if (media === 'application/json') {
                        write('Example request:', '```json', JSON.stringify(content.example || example(content.schema), null, 2), '```');
                    } else write('Use form fields shown above; binary fields are file attachments. Let your HTTP client set the multipart boundary.');
                }
            } else write('**Request body:** none.');
            const success = operation.responses['200'];
            write('**Response: HTTP 200**');
            const data = success.content['application/json'].schema.properties.data;
            write(`Envelope: \`success\`, \`message\`, and \`data\`. **data:** ${type(data)}.`);
            if (!data.$ref) fieldTable(data);
            if (success.headers) write(...Object.entries(success.headers).map(([name, header]) => `Response header \`${name}\`: ${header.description}`));
            if (operation.responses['503']) write('**Additional error: HTTP 503.** ' + operation.responses['503'].description);
        }
    }
}
write('## Schema reference', 'Required markers reflect the documented schema. For update payloads, fields are optional unless listed otherwise. MongoDB ObjectIds are 24-character hexadecimal strings; dates use ISO 8601.');
for (const [name, schema] of Object.entries(document.components.schemas)) {
    write(`<a id="schema-${anchor(name)}"></a>`, `### ${name}`, notes(schema));
    fieldTable(schema);
}
write('## Updating this file', 'Source: `src/app/docs/openapi.ts`, `paths.ts`, and `schemas.ts`. Regenerate after updating Swagger contracts:', '```sh', 'node scripts/export-api-markdown.cjs', '```');
const target = path.resolve(__dirname, '../docs/COMPLETED_APIS.md');
fs.mkdirSync(path.dirname(target), { recursive: true });
const spaced = [];
for (const line of lines) {
    const previous = spaced[spaced.length - 1] || '';
    if (line && previous && line.startsWith('|') !== previous.startsWith('|')) spaced.push('');
    spaced.push(line);
}
require('prettier').format(spaced.join('\n'), { parser: 'markdown' }).then((markdown) => {
    const count = (markdown.match(/^### (GET|POST|PATCH|DELETE) /gm) || []).length;
    if (count !== operationCount) throw new Error('Markdown operation count does not match Swagger.');
    const ids = new Set([...markdown.matchAll(/<a id="([^"]+)"/g)].map(match => match[1]));
    for (const match of markdown.matchAll(/\]\(#([^)]+)\)/g)) {
        if (!ids.has(match[1])) throw new Error('Broken internal link: ' + match[1]);
    }
    for (const match of markdown.matchAll(/```json\n([\s\S]*?)\n```/g)) JSON.parse(match[1]);
    fs.writeFileSync(target, markdown, 'utf8');
    console.log(`Verified ${operationCount} operations, internal links and JSON examples. Wrote ${target}`);
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
