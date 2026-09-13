const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const SwaggerParser = require('@apidevtools/swagger-parser');
require('ts-node/register/transpile-only');
const express = require('express');
const { createOpenApiDocument } = require('../src/app/docs/openapi');
const { setupSwagger } = require('../src/app/docs/swagger');
const root = path.resolve(__dirname, '..');

test('OpenAPI validates and operation IDs are unique', async () => {
    const doc = createOpenApiDocument();
    const operations = Object.values(doc.paths).flatMap(Object.values);
    assert.equal(
        new Set(operations.map((o) => o.operationId)).size,
        operations.length
    );
    await SwaggerParser.validate(JSON.parse(JSON.stringify(doc)));
});

test('Every mounted module route is documented or explicitly unfinished', () => {
    const source = fs.readFileSync(
        path.join(root, 'src/app/routes/index.ts'),
        'utf8'
    );
    const ast = ts.createSourceFile(
        'routes.ts',
        source,
        ts.ScriptTarget.Latest,
        true
    );
    const imports = new Map();
    const mounts = [];
    function visit(node) {
        if (
            ts.isImportDeclaration(node) &&
            node.importClause?.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)
        ) {
            for (const binding of node.importClause.namedBindings.elements)
                imports.set(binding.name.text, node.moduleSpecifier.text);
        }
        if (ts.isObjectLiteralExpression(node)) {
            const values = Object.fromEntries(
                node.properties
                    .filter(ts.isPropertyAssignment)
                    .map((p) => [p.name.getText(ast), p.initializer])
            );
            if (values.path && values.router)
                mounts.push([values.path.text, values.router.getText(ast)]);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    const exclusions = {
        '/super-admin': 'Missing task.enum and stale default Task import.',
        'get /meta/earning-chart-data':
            'Service returns only placeholder values.',
    };
    const found = new Set();
    const docs = createOpenApiDocument().paths;
    for (const [prefix, symbol] of mounts) {
        const routeFile = path.resolve(
            root,
            'src/app/routes',
            imports.get(symbol) + '.ts'
        );
        const routeAst = ts.createSourceFile(
            routeFile,
            fs.readFileSync(routeFile, 'utf8'),
            ts.ScriptTarget.Latest,
            true
        );
        function readRoute(node) {
            if (
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.expression.getText(routeAst) === 'router' &&
                ['get', 'post', 'patch', 'put', 'delete'].includes(
                    node.expression.name.text
                )
            ) {
                const method = node.expression.name.text;
                const routePath =
                    prefix + node.arguments[0].text.replace(/:(\w+)/g, '{$1}');
                const key = method + ' ' + routePath;
                if (!exclusions[prefix] && !exclusions[key]) {
                    assert.ok(
                        docs[routePath]?.[method],
                        'Missing documentation: ' + key
                    );
                    found.add(key);
                    const auth = node.arguments.find(
                        (a) =>
                            ts.isCallExpression(a) &&
                            a.expression.getText(routeAst) === 'auth'
                    );
                    const roles = auth
                        ? auth.arguments.map((a) => a.name.text).sort()
                        : [];
                    assert.deepEqual(
                        [...(docs[routePath][method]['x-roles'] || [])].sort(),
                        roles,
                        key + ' roles drifted'
                    );
                }
            }
            ts.forEachChild(node, readRoute);
        }
        readRoute(routeAst);
    }
    for (const [url, item] of Object.entries(docs))
        for (const method of Object.keys(item))
            assert.ok(
                found.has(method + ' ' + url),
                'Documented route is not mounted: ' + method + ' ' + url
            );
});

test('Docs HTML, local assets and JSON work without a database; disabling hides both endpoints', async () => {
    const previous = process.env.DOCS_ENABLED;
    delete process.env.DOCS_ENABLED;
    const app = express();
    setupSwagger(app, 'https://api.example.com/api/v1', true);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise((resolve) => server.once('listening', resolve));
        const base = 'http://127.0.0.1:' + server.address().port;
        const html = await fetch(base + '/api-docs/');
        assert.equal(html.status, 200);
        assert.match(await html.text(), /swagger-ui/);
        const asset = await fetch(base + '/api-docs/swagger-ui-bundle.js');
        assert.equal(asset.status, 200);
        await asset.arrayBuffer();
        const json = await (await fetch(base + '/api-docs.json')).json();
        assert.equal(json.servers[0].url, 'https://api.example.com/api/v1');
        process.env.DOCS_ENABLED = 'false';
        const hidden = express();
        setupSwagger(hidden);
        app.use('/hidden', hidden);
        assert.equal((await fetch(base + '/hidden/api-docs.json')).status, 404);
        assert.equal((await fetch(base + '/hidden/api-docs/')).status, 404);
    } finally {
        if (previous === undefined) delete process.env.DOCS_ENABLED;
        else process.env.DOCS_ENABLED = previous;
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
});
