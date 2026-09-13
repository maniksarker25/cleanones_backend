# Worker App — API Integration Guide

This document covers **only the APIs that are actually implemented and reachable for the worker role** right now, plus the public "manage-web" content endpoints (about us, FAQ, terms, etc.) a worker app would also need. It intentionally leaves out manager/admin-only endpoints (e.g. creating/editing worker profiles) and anything not wired into the router yet.

> Full interactive API reference (all roles): `/api-docs` on the running backend.

## ⚠️ Known limitations right now

- **Worker self-service is minimal.** The only thing a worker can currently write themselves is `working_days` (via "my availability"), and only if they're a **Freelancer**. Everything else on a worker's profile (position, hourly rate, certificates, ID documents, languages, contract type, etc.) can only be set by a manager (`/worker/create-worker` / `/worker/update-worker/:id` — not covered here since those aren't worker-role endpoints).
- **In-app chat is not available yet.** `conversation` and `message` modules exist in the codebase but their routers are **not mounted** in `routes/index.ts` — don't build against `get-chat-list` / `get-messages` yet. The file-upload endpoints below (`/file/upload-conversation-files`) exist and work, but have nothing to attach to until chat ships.
- **No assigned-task/cleaning-plan visibility for workers yet.** There's currently no endpoint for a worker to see which cleaning plans/tasks they're assigned to — only managers can view `cleaning_plan`/`task` data today.
- `POST /user/upgrade-account` exists on the route table but is a stub — it always returns `400 Upgrading account is not supported yet`. Don't build against it yet.

## How a worker account works

Workers do not self-register through this API; a manager creates the worker profile (with `worker_type`: `Employee` or `Freelancer`). The worker then logs in with the email/password they were given.

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

```json
{
  "success": true,
  "message": "Human readable message",
  "data": { ... }
}
```

List endpoints nest pagination **inside `data`**:
```json
{ "success": true, "message": "...", "data": { "meta": { "page": 1, "limit": 10, "total": 3, "totalPage": 1 }, "result": [ ... ] } }
```

### Errors

```json
{ "success": false, "message": "Reason for failure" }
```

Common codes: `400` validation/business rule, `401` missing/expired/invalid token, `403` blocked/inactive/not-allowed, `404` not found, `429` rate limited (auth routes: 3 req/min per email or IP).

---

## 1. Authentication

### `POST /auth/login`

No auth required.

**Body**
| Field | Type | Required | Notes |
|---|---|---|---|
| email | string | yes | |
| password | string | yes | |
| role | string | no | pass `"worker"` if the same email is shared across multiple roles |
| playerId | string | no | push notification device id |
| platform | string | no | `android` \| `ios` \| `web`, default `android` |

**Response `data`**
```json
{ "accessToken": "eyJhbGciOi...", "refreshToken": "eyJhbGciOi...", "role": "worker" }
```
Also sets an HttpOnly `refreshToken` cookie (web). Mobile apps should use the `refreshToken` field instead.

### `POST /auth/refresh-token`
Uses the HttpOnly cookie, no body. Returns fresh `{ accessToken, refreshToken, role }`.

### `POST /auth/change-password`
**Body**: `{ oldPassword, newPassword, confirmNewPassword }`.

### Forgot password: `POST /auth/forget-password` → `POST /auth/verify-reset-otp` → `POST /auth/reset-password`
1. `forget-password` — `{ email }` → emails a 6-digit code (valid 5 min).
2. `verify-reset-otp` — `{ email, resetCode }`.
3. `reset-password` — `{ email, password, confirmPassword }` → returns fresh tokens.

---

## 2. Profile

### `GET /user/get-my-profile`

**Response `data`**
```json
{
  "_id": "66f911aa22bb33cc44dd55ee",
  "user": { "_id": "66f911aa22bb33cc44dd55ef", "isBlocked": false, "isActive": true },
  "email": "worker@example.com",
  "phone": "+8801700000000",
  "worker_type": "Freelancer",
  "position": "Cleaner",
  "address": "House 12, Road 5, Dhaka",
  "base_location": "Dhaka",
  "languages": ["en", "bn"],
  "working_days": ["monday", "wednesday", "friday"],
  "hourly_rate": 25,
  "is_profile_completed": true,
  "certificates": [],
  "isDeleted": false
}
```

### `PATCH /user/update-profile`

Multipart form-data (supports a `profile_image` file).

**Body fields that actually apply to a worker:** `name`(→ has no effect, Worker model has no `name` field), `phone`.

> ⚠️ This is a shared endpoint used by every role, validated by one generic schema (`name`, `phone`, `profile_image`, `address`, `dateOfBirth`, `serviceTypes`). It does **not** map onto most Worker fields (`position`, `hourly_rate`, `languages`, `certificates`, `worker_type`, `national_id`, ID card images, contract PDF, etc.) — those are set by a manager only. In practice the only field a worker can change here is `phone`.

---

## 3. Availability (worker-specific)

### `PATCH /worker/my-availability`

Sets which days of the week the worker is available. **Freelancers only** — an Employee-type worker calling this gets `403 Only active freelancers can update their own availability`.

**Body**
```json
{ "working_days": ["monday", "wednesday", "friday"] }
```
Valid values (lowercase): `monday, tuesday, wednesday, thursday, friday, saturday, sunday`.

**Response `data`**: the updated worker document (same shape as the profile above).

---

## 4. Notifications

### `GET /notification/get-notifications`
Returns the worker's notifications.

### `PATCH /notification/see-notifications`
Marks all of the worker's notifications as seen. No body.

### `DELETE /notification/delete-notification/{id}`
Deletes one of the worker's notifications.

---

## 5. File upload

### `POST /file/upload-conversation-files`
Multipart upload. Intended for attaching files to chat messages — see the chat limitation note above; there's currently no chat endpoint to attach these to.

### `POST /file/delete-files`
Deletes previously uploaded files.

---

## 6. Public content ("manage-web") — no auth required

Static/marketing content the app can show a worker (or anyone). All of these are `GET`, public, and return `data: null` if nothing has been added yet in the admin panel.

| Endpoint | Shape | Notes |
|---|---|---|
| `GET /manage/get-about-us` | single object `{ description, _id, createdAt, updatedAt }` or `null` | |
| `GET /manage/get-privacy-policy` | same shape as above | |
| `GET /manage/get-terms-conditions` | same shape as above | |
| `GET /manage/get-contact-us` | `{ email, phone_number, _id, createdAt, updatedAt }` or `null` | |
| `GET /manage/get-partner` | `{ description, _id, createdAt, updatedAt }` or `null` | despite the name, this returns one "partner info" document, not a list |
| `GET /manage/get-faq` | **array** `[{ question, answer, _id, createdAt, updatedAt }]` | |
| `GET /manage/get-slider` | **array** `[{ title, image, _id, createdAt, updatedAt }]` | onboarding/promo slider images |

### `GET /legal-info/get`
Also public. Returns the shared legal/company info document: `{ venueOwner, companyName, businessType, registeredAddress, contactEmail, contactPhone, jurisdiction, officialWebsite, platformFeePercentage, freeCancellationHour }`.

---

## Quick reference table

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | – | Log in |
| POST | `/auth/refresh-token` | cookie | Refresh tokens |
| POST | `/auth/change-password` | worker | Change password |
| POST | `/auth/forget-password` → `/auth/verify-reset-otp` → `/auth/reset-password` | – | Forgot password flow |
| GET | `/user/get-my-profile` | worker | My profile |
| PATCH | `/user/update-profile` | worker | Update phone (only) |
| PATCH | `/worker/my-availability` | worker (Freelancer only) | Set working days |
| GET | `/notification/get-notifications` | worker | My notifications |
| PATCH | `/notification/see-notifications` | worker | Mark all seen |
| DELETE | `/notification/delete-notification/{id}` | worker | Delete one notification |
| POST | `/file/upload-conversation-files` | worker | Upload a file |
| POST | `/file/delete-files` | worker | Delete uploaded files |
| GET | `/manage/get-about-us` | – | About us |
| GET | `/manage/get-privacy-policy` | – | Privacy policy |
| GET | `/manage/get-terms-conditions` | – | Terms & conditions |
| GET | `/manage/get-contact-us` | – | Contact details |
| GET | `/manage/get-partner` | – | Partner info |
| GET | `/manage/get-faq` | – | FAQ list |
| GET | `/manage/get-slider` | – | Onboarding/promo slides |
| GET | `/legal-info/get` | – | Legal/company info |
