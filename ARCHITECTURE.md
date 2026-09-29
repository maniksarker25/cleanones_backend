# CleanOnes Backend — Architecture Overview

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Web framework | Express.js |
| Database | MongoDB (Mongoose ODM) |
| Realtime | Socket.io |
| Auth | JWT (access/refresh tokens) |
| File storage | AWS S3 (multer-s3) |
| Validation | Zod / Joi |
| API docs | Swagger (swagger-ui-express) |
| Notifications | Email (Resend), SMS (Twilio / Mocean), Push |
| Scheduling | node-cron |
| Logging | Winston (daily rotate) |

## 2. High-Level System Diagram

```
                                   ┌─────────────────────────┐
                                   │   Client Apps            │
                                   │  Web (Admin/Manager/     │
                                   │  Client Portal), Mobile  │
                                   └───────────┬──────────────┘
                                               │ HTTPS (REST) + WebSocket
                                               ▼
                              ┌────────────────────────────────┐
                              │        Express App (app.ts)     │
                              │  CORS · Cookie Parser · JSON     │
                              │  Rate Limiter · Swagger Docs     │
                              └───────────────┬──────────────────┘
                                               │
                     ┌─────────────────────────┼──────────────────────────┐
                     ▼                         ▼                          ▼
           ┌──────────────────┐     ┌──────────────────────┐   ┌──────────────────────┐
           │  REST API Router   │     │  Socket.io Gateway    │   │  Event Emitter /      │
           │  /api/v1/*         │     │  (chat, notifications)│   │  Listeners            │
           └─────────┬─────────┘     └───────────┬───────────┘   └───────────┬───────────┘
                     │                            │                           │
                     ▼                            ▼                           ▼
           ┌───────────────────────────────────────────────────────────────────────┐
           │                     Middleware Pipeline                                │
           │  auth() JWT verify → role check → validateRequest (Zod/Joi) →          │
           │  controller                                                           │
           └───────────────────────────────┬───────────────────────────────────────┘
                                            ▼
           ┌───────────────────────────────────────────────────────────────────────┐
           │                    Feature Modules (30+)                               │
           │  auth · user · admin · manager · worker · client · shift · task ·      │
           │  cleaning_plan · location · room · chat · notification · invoice ·     │
           │  issue_report · legal_info · file-upload · meta · superAdmin ...       │
           └───────────────────────────────┬───────────────────────────────────────┘
                                            ▼
                     ┌──────────────────────┴───────────────────────┐
                     ▼                                              ▼
           ┌──────────────────────┐                       ┌──────────────────────┐
           │   MongoDB (Mongoose)  │                       │   External Services   │
           │   Collections per     │                       │   AWS S3, Twilio,     │
           │   module               │                       │   Resend, PayPal,     │
           │                        │                       │   Google/Apple Auth   │
           └────────────────────────┘                       └──────────────────────┘
```

## 3. Request Lifecycle

```
Client Request
     │
     ▼
[CORS / JSON / Cookie parsers]
     │
     ▼
[Route: /api/v1/<module>]
     │
     ▼
[auth(...roles) middleware]  ── verifies JWT, loads profile (Admin/Manager/Worker/Client/SuperAdmin),
     │                           checks isBlocked / isVerified / isActive / role
     ▼
[validateRequest(zodSchema)] ── validates req.body / params / query
     │
     ▼
[Controller] ── thin, calls service
     │
     ▼
[Service] ── business logic, Mongoose queries/transactions
     │
     ▼
[Model] ── Mongoose schema/collection
     │
     ▼
sendResponse() ──► JSON response
     │
     └── on error ──► globalErrorHandler ──► formatted error response
```

## 4. Module Structure (per feature)

Every module under `src/app/modules/<name>/` follows the same pattern:

```
<module>/
 ├─ <module>.routes.ts        Express routes + auth/role guards
 ├─ <module>.controller.ts    Request/response handling
 ├─ <module>.services.ts      Business logic
 ├─ <module>.model.ts         Mongoose schema
 ├─ <module>.interface.ts     TypeScript types
 └─ <module>.validation.ts    Zod/Joi request schemas
```

This is scaffolded automatically via `npm run create-module`.

## 5. User Roles & Access Control

```
                     ┌───────────────┐
                     │   SuperAdmin   │  full system control
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │     Admin      │  operational management
                     └───────┬────────┘
              ┌──────────────┼───────────────┐
              ▼                              ▼
      ┌───────────────┐              ┌───────────────┐
      │    Manager     │              │    Client      │
      │  schedules,    │              │  requests      │
      │  assigns shifts│              │  services       │
      └───────┬────────┘              └───────────────┘
              │
              ▼
      ┌───────────────┐
      │    Worker      │  executes cleaning tasks/shifts
      └───────────────┘
```

Each role maps to its own Mongoose collection (`Admin`, `Manager`, `Worker`, `Client`, `SuperAdmin`), all linked to a shared `User` collection holding auth/account status (`isBlocked`, `isVerified`, `isActive`).

## 6. Core Domain Flow (Cleaning Operations)

```
Client ──creates──► Location ──has many──► Room
                                             │
Cleaning Plan ──defines tasks for──► Room ◄──┘
     │
     ▼
Shift ──assigned to──► Worker/Manager (bulk or individual assignment)
     │
     ▼
Task / Additional Task ──performed during──► Shift
     │
     ▼
Issue Report (optional) ──raised during── Shift
     │
     ▼
Invoice ──generated from── completed Shifts/Tasks
```

## 7. Realtime Layer (Socket.io)

```
socket/socket.ts ── initializeSocket(httpServer)
     │
     ├─ Auth handshake (JWT)
     ├─ Chat namespace ── handleChat.ts
     │     Conversation ↔ ChatMessage ↔ Message modules
     └─ Notification push ── notification module
```

## 8. Event-Driven Side Effects

```
Service action (e.g. Shift created/updated)
     │
     ▼
EventEmitter.emit('shift.updated', payload)
     │
     ▼
Listener (src/app/events/listeners/shift.listener.ts)
     │
     ├─► Notification module (push/email/SMS)
     ├─► Chat module (system messages)
     └─► Other module side-effects (client, cleaning_plan, location, issue_report, additional_task)
```

Decouples core CRUD services from cross-module side effects (notifications, chat messages, cascading updates).

## 9. Cross-Cutting Concerns

- **Error handling**: `AppError` class + `globalErrorHandler` middleware → consistent JSON error shape.
- **Logging**: Winston with daily-rotate file transport (`src/app/shared/logger`).
- **Rate limiting**: `express-rate-limit` configured per-route group (`rateLimiter.middleware.ts`).
- **File uploads**: `multer` + `multer-s3` streaming directly to AWS S3.
- **API documentation**: Auto-generated Swagger UI at runtime (`src/app/docs`), driven by `paths.ts` / `schemas.ts`.
- **DB seeding**: `src/app/DB` seeds a default SuperAdmin on startup.

## 10. Directory Map

```
src/
 ├─ app.ts, server.ts              Express + HTTP server bootstrap
 ├─ app/
 │   ├─ modules/                   Feature modules (30+, see §4)
 │   ├─ middlewares/                auth, validateRequest, rateLimiter, error handlers
 │   ├─ routes/                     Central route aggregator
 │   ├─ socket/                     Socket.io setup + chat handlers
 │   ├─ events/                     EventEmitter + listeners (cross-module side effects)
 │   ├─ docs/                       Swagger paths & schemas
 │   ├─ config/                     Env config loader
 │   ├─ DB/                         Startup seeding
 │   ├─ error/                      AppError, error formatters
 │   ├─ shared/                     Logger, shared utils
 │   ├─ helper/                     Email/notification helpers
 │   └─ utilities/                  catchAsync, sendResponse, etc.
 └─ scripts/                        One-off maintenance/migration scripts
```
