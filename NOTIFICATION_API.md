# Notification API Reference

REST endpoints + Socket.IO events for the notification system. For how it works under the hood (event flow, why chat is separate, etc.), see `docs/NOTIFICATION_SYSTEM.md`.

> Chat itself has its own, separate realtime reference: `docs/CHAT_SOCKET_EVENTS.md`. Chat messages do **not** appear here — see the note at the bottom of this doc.

## Base URL

```
{{BASE_URL}}/api/v1
```

## Auth

Every endpoint below requires:
```
Authorization: Bearer <accessToken>
```

Allowed roles (all three endpoints, same list): `superAdmin`, `admin`, `manager`, `client`, `worker`.

## Standard response shape

```json
{ "success": true, "message": "...", "data": { ... } }
```

---

## REST endpoints

### `GET /notification/get-notifications`

Lists the caller's own notifications, newest first by default.

**Query params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | integer | 1 | |
| `limit` | integer | 10 | |
| `searchTerm` | string | — | case-insensitive regex match on `title` |
| `sort` | string | `-createdAt` | prefix with `-` for descending |
| `fields` | string | — | comma-separated field allowlist, e.g. `title,message` |

**Response `data`**
```json
{
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 23,
    "totalPage": 3,
    "unreadCount": 5
  },
  "result": [
    {
      "_id": "66fb1122aa33bb44cc55dd66",
      "receiver": "66f911aa22bb33cc44dd55ee",
      "type": "CLEANING_PLAN_WORKER_ASSIGNED",
      "title": "New cleaning plan assignment",
      "message": "You've been assigned to the cleaning plan \"Downtown Office Weekly\".",
      "data": {
        "entity": "CLEANING_PLAN",
        "action": "VIEW",
        "entityId": "66fa1b2c3d4e5f6a7b8c9d10",
        "meta": { "planId": "66fa1b2c3d4e5f6a7b8c9d10" }
      },
      "isRead": false,
      "isSeen": false,
      "createdAt": "2026-09-14T09:12:00.000Z",
      "updatedAt": "2026-09-14T09:12:00.000Z"
    }
  ]
}
```

`meta.unreadCount` is the receiver's total unread count — independent of the current page/filter, useful for a badge.

> A `superAdmin` caller's notifications are stored under a shared `receiver: "admin"` bucket rather than their own id — this endpoint handles that automatically; nothing different on the client side.

### `PATCH /notification/see-notifications`

Marks **every** notification belonging to the caller as read (`isRead: true`). No body.

**Response `data`**: a Mongo `updateMany` result:
```json
{ "acknowledged": true, "matchedCount": 5, "modifiedCount": 5 }
```

There is currently no single-notification "mark as read" endpoint — only all-at-once.

### `DELETE /notification/delete-notification/{id}`

Deletes one notification. Scoped to the caller — deleting an id that belongs to someone else (or doesn't exist) returns `data: null`, not an error.

**Response `data`**: the deleted notification document, or `null` if nothing matched.

---

## What you'll actually see (`type` / `data.entity` values)

| `type` | `data.entity` | Fired when | `data.meta` |
|---|---|---|---|
| `CLEANING_PLAN_CREATED` | `CLEANING_PLAN` | A plan is created (sent to the client + any workers assigned at creation) | `{ planId }` |
| `CLEANING_PLAN_WORKER_ASSIGNED` | `CLEANING_PLAN` | A worker is newly added to a plan | `{ planId }` |
| `CLEANING_PLAN_WORKER_REMOVED` | `CLEANING_PLAN` | A worker is taken off a plan | `{ planId }` |
| `CLEANING_PLAN_DELETED` | `CLEANING_PLAN` | A plan is cancelled (sent to the client + everyone who was on it) | `{ planId }` |
| `ADDITIONAL_TASK_CREATED` | `ADDITIONAL_TASK` | A client requests extra work — sent to **every manager** | `{ planId, clientId }` |
| `ADDITIONAL_TASK_APPROVED` | `ADDITIONAL_TASK` | A manager approves a request — sent to the client | `{ planId }` |
| `ADDITIONAL_TASK_REJECTED` | `ADDITIONAL_TASK` | A manager rejects a request — sent to the client | `{ planId }` |
| `SHIFT_CHECKED_IN` | `SHIFT` | A worker checks in — sent to **every manager** | `{ planId, workerId, at }` |
| `SHIFT_CHECKED_OUT` | `SHIFT` | A worker checks out — sent to **every manager** | `{ planId, workerId, at }` |
| `SHIFT_COMPLETED` | `SHIFT` | Every task on a shift is done — sent to the client **and** every manager | `{ planId }` |

`data.entityId` is always the relevant document's id (the plan, task, or shift). `data.action` is currently always `"VIEW"`.

`NEW_CHAT_MESSAGE` and `SUPPORT_CREATED` exist as defined types but are not used by the flows above — see the chat note at the bottom, and Support is a currently-unmounted module.

---

## Socket.IO

Connects on the same server as REST (`/socket.io`, default namespace). Auth: pass the access token as `socket.handshake.auth.token` or a `?token=` query param — same JWT as REST. Full connection/handshake/room details live in `docs/CHAT_SOCKET_EVENTS.md` (the socket infrastructure is shared with chat); the one event relevant to notifications specifically:

### `notification` (server → client)

Delivered to the receiver's own personal room (`io.to(profileId)`) — **only if they're currently online**. If they're offline, nothing is emitted; a OneSignal push goes to their registered device(s) instead, and the `Notification` row (visible via the REST endpoint above) is created either way regardless of which path fired.

**Payload**: the full `Notification` document — same shape as one item in `GET /notification/get-notifications`'s `result` array.

```js
socket.on('notification', (notification) => {
  // notification.type, notification.title, notification.message, notification.data...
});
```

There's no ack, no acknowledgement needed — just update your UI (badge count, toast, list) when it arrives. If you want the authoritative unread count rather than incrementing client-side, re-fetch `GET /notification/get-notifications` (or at least trust its `meta.unreadCount` on next load).

---

## Chat messages are not part of this system

If you're expecting chat messages to show up via `GET /notification/get-notifications` or the `notification` socket event — they won't. Chat has its own delivery path entirely (realtime via `group:new-message`/`message:new`, offline via a separate collapsed OneSignal push with no DB row) to avoid flooding this feed with one entry per message. See `docs/CHAT_SOCKET_EVENTS.md` for the full chat contract, and the "Why chat is different" section of `docs/NOTIFICATION_SYSTEM.md` for the reasoning.
