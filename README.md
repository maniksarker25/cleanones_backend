# cleanones-backend

The [Markdown API reference](docs/COMPLETED_APIS.md) includes endpoint details, request examples, schemas, authentication, and current limitations for the 72 documented operations. Regenerate it with `node scripts/export-api-markdown.cjs` after updating the Swagger contracts.

## View API documentation now

The standalone Swagger UI does not need MongoDB, secrets, or a working application build:

```sh
npm install
npm run docs:dev
```

Open **http://localhost:3001/api-docs**. Download the OpenAPI 3.0.3 specification at **http://localhost:3001/api-docs.json** (also importable into Postman).

The main application also mounts `/api-docs` and `/api-docs.json` on its own port. Its current missing-module and TypeScript errors must be resolved before it can start.

## Configuration

| Variable     | Default | Purpose                                                             |
| ------------ | ------- | ------------------------------------------------------------------- |
| DOCS_PORT    | 3001    | Standalone preview port; binds to loopback.                         |
| DOCS_API_URL | unset   | Full backend base URL ending in /api/v1, for standalone Try it out. |
| DOCS_ENABLED | true    | Set exactly false to hide both documentation endpoints.             |

The standalone server serves documentation only. Try it out is disabled until DOCS_API_URL is supplied. Cross-origin requests need the backend's CORS allowlist to include the docs origin. For HttpOnly refresh cookies, use the docs on the main backend origin. Main-app docs always target that origin's /api/v1.

Swagger assets are served locally. Tokens are not persisted across page reloads, and the external Swagger validator is disabled. Docs are publicly readable when enabled; control access through your deployment proxy or disable them as appropriate.

Swagger UI configuration reference: [official documentation](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/).

## Using the API

1. Log in with an existing verified, active account.
2. Copy data.accessToken into Swagger's Authorize dialog (without the Bearer prefix).
3. Manager workflow: create a client, create its location, create a room, then create tasks.
4. Weekly tasks require days_of_week; monthly tasks require days_of_month.
5. Lists return data.meta and data.result. Successful writes use HTTP 200.
6. Login sets the refreshToken cookie. Password recovery is forget-password → verify-reset-otp → reset-password.

Examples use fictional values. Replace ObjectIds with records from your backend.

## Coverage and known implementation gaps

72 operations are documented: authentication, clients, locations, rooms, tasks, administration, website content, notifications, files, legal information, and implemented dashboard operations.

| Area                             | Current limitation                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application startup              | Customer validation and task.enum are missing; old Task imports and an auth ObjectId type mismatch also prevent a clean build.                       |
| Manager/admin authentication     | auth.ts does not resolve these profiles correctly. Protected requests can fail before their controllers.                                             |
| User / super-admin routes        | Excluded because their dependencies/contracts are unfinished.                                                                                        |
| Earnings chart                   | Excluded: service returns only empty arrays and zero.                                                                                                |
| Conversation / message / support | Routers exist but are not mounted.                                                                                                                   |
| Testimonials                     | Route file is empty.                                                                                                                                 |
| Dashboard                        | Report counts are placeholders; Client date aggregations use createdAt while its model stores created_at.                                            |
| Validation                       | Zod failures currently return HTTP 500. validateRequest checks parsed values without replacing req.body, so coercions/defaults are not written back. |
| Uploads                          | conversation_video is not accepted by the uploader; videos currently returns an empty array.                                                         |
| Admin profile update             | superAdmin route searches Admin using the caller's user ID and can return null.                                                                      |

The specification describes current contracts, not a guarantee that the unfinished backend is production-ready. Root greeting, static uploads and the separate contact email helper are outside this versioned API reference.

## Maintain the documentation

-   Edit src/app/docs/schemas.ts for payload and model schemas.
-   Edit src/app/docs/paths.ts for paths, roles, examples, request media, responses and limitations.
-   Edit src/app/docs/openapi.ts for metadata, security schemes and tags.
-   Document only mounted routes with implemented handlers. Remove an exclusion from scripts/check-docs.cjs when completing its module.
-   Keep response schemas aligned with controller/service return values; do not assume all lists or deletes share a shape.

```sh
npm run docs:check
npm run docs:typecheck
```

The checks validate the OpenAPI document, unique operation IDs, route and role coverage, local Swagger assets, JSON serving and the disable switch without importing application services or connecting to a database.
