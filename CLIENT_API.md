# Client App — API Integration Guide

This document covers **only the APIs used by the client (customer) role**. It does not cover manager/admin/worker-only endpoints. This is a plain reference for frontend integration, not the full Swagger spec.

> Full interactive API reference (all roles): `/api-docs` on the running backend.

## How a client account works

Clients do **not** self-register. A manager creates the client account (`POST /client/create-client`) and the client receives their **email + password** by email. From then on, the client just logs in.

## Base URL

```
{{BASE_URL}}/api/v1
```

## Auth header

Every endpoint below except `POST /auth/login` requires:

```
Authorization: Bearer <accessToken>
```

## Standard response shape

Every response follows this envelope:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": { ... }
}
```

List/paginated endpoints nest pagination **inside `data`**, not at the top level:

```json
{
  "success": true,
  "message": "...",
  "data": {
    "meta": { "page": 1, "limit": 10, "total": 23, "totalPage": 3 },
    "result": [ ... ]
  }
}
```

### Errors

```json
{
  "success": false,
  "message": "Reason for failure"
}
```

Common status codes: `400` validation/business rule failure, `401` missing/expired/invalid token, `403` blocked/inactive account, `404` not found, `429` rate limited (auth routes: 3 req/min per email or IP).

---

## 1. Authentication

### `POST /auth/login`

No auth required.

**Body**
| Field | Type | Required | Notes |
|---|---|---|---|
| email | string | yes | |
| password | string | yes | |
| role | string | no | pass `"client"` if the same email is shared across multiple roles |
| playerId | string | no | push notification device id |
| platform | string | no | `android` \| `ios` \| `web`, default `android` |

**Response `data`**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "role": "client"
}
```

Also sets an **HttpOnly** `refreshToken` cookie (browsers handle this automatically; mobile apps should use the `refreshToken` field in the body instead).

### `POST /auth/refresh-token`

Uses the HttpOnly cookie — no body needed on web. Returns a fresh `{ accessToken, refreshToken, role }`.

### `POST /auth/change-password`

**Body**: `{ oldPassword, newPassword, confirmNewPassword }` — `newPassword` must equal `confirmNewPassword`.

### `POST /auth/forget-password` → `POST /auth/verify-reset-otp` → `POST /auth/reset-password`

Standard forgot-password flow if the client can't remember their manager-issued password:
1. `forget-password` — `{ email }` → emails a 6-digit code (valid 5 min).
2. `verify-reset-otp` — `{ email, resetCode }`.
3. `reset-password` — `{ email, password, confirmPassword }` → returns fresh tokens.

---

## 2. Profile

### `GET /user/get-my-profile`

Returns the client's own profile document.

**Response `data`**
```json
{
  "_id": "66f911aa22bb33cc44dd55ee",
  "user": {
    "_id": "66f911aa22bb33cc44dd55ef",
    "isBlocked": false,
    "isActive": true
  },
  "name": "Acme Corp",
  "email": "acme@example.com",
  "phone": "+8801700000000",
  "company_name": "Acme Corporation",
  "licence_expiration_date": "2027-01-01T00:00:00.000Z",
  "contract_status": "Active",
  "manager": "66f8aa11bb22cc33dd44ee55",
  "isDeleted": false
}
```

### `PATCH /user/update-profile`

Multipart form-data (supports a `profile_image` file).

**Body fields that actually apply to a client:**
| Field | Type | Notes |
|---|---|---|
| name | string | |
| phone | string | |

> ⚠️ This is a shared endpoint used by every role. Other fields it accepts (`address`, `dateOfBirth`, `serviceTypes`, `profile_image`) exist on other roles' profiles, not the Client model — sending them has no effect for a client. `company_name`, `licence_expiration_date` and `contract_status` can only be changed by the client's manager (`PATCH /client/update-client/:id`), not by the client themself.

---

## 3. Locations — "my sites"

### `GET /location/my-locations`

Returns only locations belonging to the logged-in client.

**Query params**: `page`, `limit` (default 10), `searchTerm` (matches name/address), `sort` (e.g. `-created_at`).

**Response `data.result[]` item**
```json
{
  "_id": "66fa1b2c3d4e5f6a7b8c9d10",
  "name": "Downtown Office",
  "address": "123 Main St, Dhaka",
  "description": "Main downtown branch",
  "type": "Hotel",
  "is_active": true,
  "location": { "type": "Point", "coordinates": [90.4125, 23.8103] },
  "total_room": 6,
  "created_at": "2026-08-01T10:15:00.000Z",
  "updated_at": "2026-09-10T08:22:00.000Z"
}
```

`type` is one of `Hotel` | `School` | `Hospital` | `Other`.

`location` (the GeoJSON point) is only present if it was set when the location was created. `total_room` is the count of active rooms at that location.

---

## 4. Rooms — "rooms at one of my locations"

### `GET /room/my-rooms/{locationId}`

`locationId` must be one of the client's own locations (from step 3) — otherwise `404 Location not found`.

**Query params**: same as locations (`page`, `limit`, `searchTerm` matches name/room_type/cleaning_type, `sort`).

**Response `data.result[]` item**
```json
{
  "_id": "66fb2a11bb22cc33dd44ee01",
  "name": "Conference Room A",
  "room_type": "meeting_room",
  "cleaning_type": "Standard",
  "floor": 2,
  "is_active": true,
  "location": { "_id": "66fa1b2c3d4e5f6a7b8c9d10", "name": "Downtown Office", "address": "123 Main St, Dhaka" },
  "total_task": 4,
  "created_at": "2026-08-05T11:00:00.000Z",
  "updated_at": "2026-09-01T09:30:00.000Z"
}
```

`total_task` is the count of active recurring task definitions in that room.

---

## 5. Tasks — "recurring cleaning tasks in one of my rooms"

### `GET /task/my-tasks/{roomId}`

`roomId` must be inside one of the client's own locations — otherwise `404 Room not found`.

**Query params**: `page`, `limit`, `searchTerm` (matches name), `sort`.

**Response `data.result[]` item**
```json
{
  "_id": "66fc3311aa22bb33cc44dd02",
  "name": "Clean meeting table",
  "frequency_type": "weekly",
  "is_photo_required": true,
  "photo_requirements": [
    { "title": "Before cleaning", "photo_url": null, "is_uploaded": false }
  ],
  "duration_minutes": 15,
  "days_of_week": ["mon", "fri"],
  "is_active": true,
  "room": { "_id": "66fb2a11bb22cc33dd44ee01", "name": "Conference Room A", "room_type": "meeting_room", "cleaning_type": "Standard", "floor": 2 },
  "created_at": "2026-08-05T11:05:00.000Z",
  "updated_at": "2026-08-05T11:05:00.000Z"
}
```

`frequency_type` is `daily` | `weekly` | `monthly` — `weekly` tasks carry `days_of_week` (`mon`..`sun`), `monthly` tasks carry `days_of_month` (1–31) instead. These are **read-only definitions set by the manager** — a client cannot create/edit/delete tasks, only view them.

---

## 6. Additional task requests — "ask for extra work"

This is how a client requests one-off work beyond the standard recurring tasks above, tied to a **cleaning plan** (a manager-scheduled cleaning run at one of the client's locations).

> ⚠️ **Backend gap to flag to the API team:** there is currently no client-facing endpoint to list a client's own cleaning plans, so the frontend needs `cleaning_plan_id` from somewhere else (e.g. a plan reference included in a push notification, or shared out-of-band). Also, these additional-task endpoints do not currently verify that the cleaning plan actually belongs to the calling client — any authenticated client can act on any `cleaning_plan_id`/`id` it's given. Treat `cleaning_plan_id` and task `id`s as capability tokens for now (don't let the client guess/enumerate them), and ask the backend team to add ownership checks before this ships.

### `POST /additional-task/create-additional-task`

**Body**
| Field | Type | Required | Notes |
|---|---|---|---|
| cleaning_plan_id | string (ObjectId) | yes | |
| name | string | yes | |
| description | string | no | |
| duration_minutes | number | yes | ≥ 0 |
| is_photo_required | boolean | no | |
| photo_requirements | array | no | `[{ title, photo_url?, is_uploaded? }]` |
| date_time | date-time | yes | when the extra work should happen |

Returns `201` with the created task (`is_completed: false`, `is_approved: false` — a manager must approve it).

### `PATCH /additional-task/update-additional-task/{id}`

Same fields as create, all optional (partial update). A client **cannot** set `is_approved` through this endpoint (silently stripped server-side even if sent) — only a manager can approve/reject via a separate endpoint.

### `DELETE /additional-task/delete-additional-task/{id}`

Response `data`: `{ "message": "Additional task deleted successfully" }` (not `null` like other deletes in this API).

### `GET /additional-task/all-additional-tasks/{planId}`

Paginated list of additional tasks under one cleaning plan. Query params: `page`, `limit`, `searchTerm` (matches name/description), `sort`, plus any raw field name is passed straight through as a Mongo filter (e.g. `?is_approved=true`).

### `GET /additional-task/single-additional-task/{id}`

Returns one additional task document (same shape as the create response).

---

## 7. Notifications

### `GET /notification/get-notifications`

Returns the client's notifications.

### `PATCH /notification/see-notifications`

Marks all of the client's notifications as seen. No body.

### `DELETE /notification/delete-notification/{id}`

Deletes one notification belonging to the client.

---

## Quick reference table

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Log in |
| POST | `/auth/refresh-token` | Refresh tokens |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/forget-password` → `/auth/verify-reset-otp` → `/auth/reset-password` | Forgot password flow |
| GET | `/user/get-my-profile` | My profile |
| PATCH | `/user/update-profile` | Update name/phone |
| GET | `/location/my-locations` | My locations |
| GET | `/room/my-rooms/{locationId}` | Rooms at one of my locations |
| GET | `/task/my-tasks/{roomId}` | Recurring tasks in one of my rooms |
| POST | `/additional-task/create-additional-task` | Request extra work |
| PATCH | `/additional-task/update-additional-task/{id}` | Edit my request |
| DELETE | `/additional-task/delete-additional-task/{id}` | Cancel my request |
| GET | `/additional-task/all-additional-tasks/{planId}` | List requests under a plan |
| GET | `/additional-task/single-additional-task/{id}` | One request |
| GET | `/notification/get-notifications` | My notifications |
| PATCH | `/notification/see-notifications` | Mark all seen |
| DELETE | `/notification/delete-notification/{id}` | Delete one notification |
