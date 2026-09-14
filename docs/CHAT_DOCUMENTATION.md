# Chat System — Full Documentation

Everything about the chat system in one place: the 4 chat types, the 4 REST
endpoints (list/read only — messages are never created over REST), and every
Socket.IO event with its payload and response shape. Base REST path:
`/api/v1/chat` and `/api/v1/chat-message`. Also documented in Swagger
(`/api-docs`, tags **Chats** / **Chat messages**, plus a rendered Socket.IO
table at the top of the page) and machine-readably as the `x-socket-events`
extension in `/api-docs.json`. This file is the authoritative prose version.

---

## 1. The four chat types

A single `Chat` collection holds all four; `type` tells them apart.

| `type` | Members | Created when | Name shown |
| --- | --- | --- | --- |
| `group` | the client + every currently-assigned worker on a `CleaningPlan`; every manager implicitly | a `CleaningPlan` gets its first worker assignment | the cleaning plan's title (stored, same for everyone) |
| `direct` | exactly one client + one worker | either party sends the first message (`send-message` socket event) or calls to start one | not applicable — 1:1, no name needed |
| `worker` | exactly one worker; every manager implicitly | a worker profile is created (`POST /worker/create-worker`) | **worker sees `"Managers"`**, **manager sees the worker's own name** |
| `client` | exactly one client; every manager implicitly | a client profile is created (`POST /client/create-client`) | **client sees `"Manager"`** (singular), **manager sees the client's own name** |

Managers are *implicit* members of `group`, `worker`, and `client` chats —
they don't need to be added and always pass the access check for those three.
Managers are never members of `direct` chats (private between a client and a
worker). `display_name` is **computed per request, never stored** — it
depends on who's asking.

Access rule (`ensureChatAccessOrThrow`), used by both REST and sockets:
- **Manager** → auto-passes for `group`, `worker`, `client`. For `direct`,
  same rule as everyone else below.
- **Client / worker** → must actually be the chat's `client` or be present in
  its `workers` array, or it's a 403.

---

## 2. REST API — Chats (`/api/v1/chat`)

All 3 endpoints require `Authorization: Bearer <accessToken>`. Envelope for
every response: `{ success, message, data }`. Errors: `{ success:false,
message, errorDetails? }`.

### 2.1 `GET /chat/my-chats`
**Role: manager, client, worker**

One unified, paginated, sorted list covering **all four types at once** — not
four separate endpoints merged in code, a single indexed query per role. This
endpoint replaced the old separate `my-groups` / `my-direct-chats` endpoints.

| Role | Sees |
| --- | --- |
| manager | every active `group`, `worker`, and `client` chat in the system (never `direct` — private to the two parties) |
| client | every active chat where they are the `client` (their `group` chats, their `direct` chats, their own `client` chat) |
| worker | every active chat where they are in `workers` (their `group` chats, their `direct` chats, their own `worker` chat) |

Sorted `last_message_at` desc, then `created_at` desc — all four types
interleaved by recency, not grouped by type.

**Query params**: `page` (default 1), `limit` (default 20).

**Response `data`**:
```jsonc
{
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPage": 1 },
  "result": [
    {
      "_id": "...",
      "type": "group",                 // "group" | "direct" | "worker" | "client"
      "cleaning_plan": "...",          // group only, else null
      "name": "Downtown Office",       // group only (stored), else null
      "display_name": "Downtown Office", // computed for the CALLING viewer — see rule in §1
      "client": { "_id": "...", "name": "...", "email": "...", "phone": "..." }, // populated, null for worker-type chats
      "workers": [ { "_id": "...", "name": "...", "worker_type": "...", "user": { "full_name": "...", "profile_photo": null } } ],
      "participant_key": null,          // direct chats only
      "last_message": { "_id": "...", "text": "...", "sender": { "full_name": "...", "profile_photo": null, "email": "..." }, "created_at": "..." },
      "last_message_at": "2026-09-10T12:00:00.000Z",
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```
Use `type` to distinguish entries and `display_name` to show a name that's
already correct for all four types (don't hand-roll the worker/client naming
rule client-side — read it from here).

### 2.2 `GET /chat/{id}/members`
**Role: manager, client, worker**

Access: manager auto-passes for `group`/`worker`/`client`; otherwise caller
must actually be a member (client or in workers) — 403 otherwise.

**Path param**: `id` — chat ObjectId.

**Response `data`**:
```jsonc
{
  "client": { "_id": "...", "name": "...", "email": "...", "phone": "..." }, // null if type has no client
  "workers": [ { "_id": "...", "name": "...", "email": "...", "phone": "...", "worker_type": "...", "user": { "full_name": "...", "profile_photo": null } } ],
  "managers": "all",          // present (always "all") only when type is group/worker/client; absent for direct
  "display_name": "Managers"  // computed for the calling viewer, same rule as §1 — null for direct chats
}
```

### 2.3 `PATCH /chat/{id}/rename`
**Role: manager only**

`group` chats only — 400 for `direct`/`worker`/`client` (none of those have a
single stored name to rename; worker/client chat names are always computed,
never stored). Emits `group:renamed` over Socket.IO (best-effort; the HTTP
response never depends on the socket push succeeding).

**Body**: `{ "name": "New Group Name" }` (required, non-empty).

**Response `data`**: the updated `Chat` object (§4 schema).

---

## 3. REST API — Chat messages (`/api/v1/chat-message`)

There is **no REST endpoint to create a message** — every message is created
over Socket.IO (§5). REST here only reads and soft-deletes.

### 3.1 `GET /chat-message/{chatId}`
**Role: manager, client, worker**

Same membership rule as `ensureChatAccessOrThrow` (§1). Internally queried
newest-first for correct pagination, then reversed, so `data.result` comes
back **oldest-first** (natural chat scroll order). `sender` is populated.

**Path param**: `chatId`. **Query params**: `page` (default 1), `limit`
(default 20).

**Response `data`**: `{ meta: Pagination, result: ChatMessage[] }` (§4
schema), chronological oldest→newest.

### 3.2 `DELETE /chat-message/{id}`
**Role: manager, client, worker**

Soft delete only — sets `is_deleted: true` + `deleted_at`; the document is
never actually removed. Allowed for:
- the original sender (matched by **User account id**, not profile id), or
- a manager, but **only** on a `group`, `worker`, or `client` chat (moderator
  override) — a manager **cannot** delete a `direct` chat message they didn't
  send.

Emits `group:message-deleted` (group/worker/client, includes `role:manager`)
or `message:deleted` (direct, excludes it) over Socket.IO — best-effort.

**Path param**: `id` — message ObjectId.

**Response `data`**: the updated `ChatMessage` object (`is_deleted: true`).

---

## 4. Shared schemas

### `Chat`
| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | |
| `type` | `'group'\|'direct'\|'worker'\|'client'` | |
| `cleaning_plan` | ObjectId \| null | group only |
| `name` | string \| null | group only (stored); prefer `display_name` |
| `display_name` | string \| null | **computed per viewer**, only present on `my-chats`/`members` responses, not on write responses |
| `client` | ObjectId (writes) \| populated object (reads) \| null | null for `worker` chats |
| `workers` | ObjectId[] (writes) \| populated object[] (reads) | empty for `client` chats; length 1 for `direct`/`worker` |
| `participant_key` | string \| null | direct only, sorted `${clientId}:${workerId}` |
| `last_message` | ObjectId \| populated `ChatMessage` \| null | |
| `last_message_at` | date-time \| null | |
| `last_updated_by` | ObjectId \| null | |
| `is_active` | boolean | false = soft-deactivated (worker/client removed, or plan deleted); still queryable for history, excluded from `my-chats` |
| `created_at` / `updated_at` | date-time | |

### `ChatMessage`
| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | |
| `chat` | ObjectId | |
| `sender` | ObjectId (writes) \| populated `{_id, full_name, profile_photo, email}` (reads) | **User account id**, not profile id |
| `sender_role` | `'client'\|'worker'\|'manager'` | |
| `text` | string | |
| `attachments` | `ChatAttachment[]` | `{ url: string, type: 'image'\|'video'\|'pdf'\|'file' }` |
| `seen` | boolean | direct chats only — meaningless for group/worker/client (multiple recipients) |
| `is_deleted` | boolean | soft-delete flag |
| `deleted_at` | date-time \| null | |
| `created_at` / `updated_at` | date-time | |

---

## 5. Socket.IO — connection & auth

Default path `/socket.io`, default namespace `/`, same server/port as REST.

**Handshake auth** — send the access token either way:
```js
io(url, { auth: { token: accessToken } });
// or
io(url, { query: { token: accessToken } });
```
Verified with the same JWT secret as REST, expecting `{ profileId, id, role }`
in the payload. Missing/invalid token → `socket.disconnect()` immediately,
**no error event** (check your connect error handler, not a socket-error
listener, for auth failures).

**On successful connect, the server automatically:**
1. `socket.join(profileId)` — a personal room for direct delivery regardless of which chat rooms you've joined.
2. If `role === 'manager'`: also `socket.join('role:manager')` — managers receive `group`/`worker`/`client` chat events without joining each one individually.
3. Adds you to an **in-memory** online-users set and broadcasts `onlineUser` to everyone. Not persisted — resets on server restart.

**Rooms**:
| Room | Members | Purpose |
| --- | --- | --- |
| `<profileId>` | one user | personal delivery target for `*:new-message`, `*:deleted`, `*:seen`, etc. |
| `role:manager` | every connected manager | group/worker/client visibility without per-chat joins |
| `group:<chatId>` | whoever called `group:join` | typing indicators; also a broadcast target (name is historical — used for all 4 chat types) |

`group:join` is **not required** to receive messages (personal-room delivery
already covers that) — only join a chat's room if you want typing indicators
for it.

---

## 6. Socket.IO — client → server events

### `group:join`
Join a chat's realtime room.
**Payload**: `{ groupId: string }` (a `Chat._id`, any of the 4 types despite the name).
**Ack**: none. On failure (missing `groupId`, or access check fails per §1) emits `socket-error` back to you instead.

### `group:leave`
**Payload**: `{ groupId: string }`. No ack. No error if `groupId` missing — silent no-op.

### `group:send-message`
Send into any chat you're already a member of (works for all 4 types).
**Payload**:
```ts
{
  groupId: string;        // Chat _id
  text?: string;           // text or attachments required (at least one)
  attachments?: { url: string; type: 'image'|'video'|'pdf'|'file' }[];
}
```
**Ack**: `{ success: true, data: ChatMessage } | { success: false, message: string }`.
On success also broadcasts `group:new-message` (group/worker/client) or `message:new` (direct) — see §7. On failure, both the ack **and** a `socket-error` fire.

### `group:delete-message`
**Payload**: `{ messageId: string }`.
Same permission rule as `DELETE /chat-message/{id}` (§3.2).
**Ack**: same shape as `group:send-message`. On success also broadcasts `group:message-deleted` or `message:deleted`.

### `group:typing`
**Payload**: `{ groupId: string; name: string }`. No ack. Relayed to everyone else in `group:<groupId>` (sender excluded).

### `group:stop-typing`
**Payload**: `{ groupId: string }`. No ack. Relayed the same way.

### `send-message`
Convenience for **starting** a `direct` chat by the other party's `profileId` — **client and worker only** (a manager calling this errors; managers don't have direct chats). Finds-or-creates the `direct` chat idempotently (keyed by sorted `clientId:workerId`), then sends.
**Payload**:
```ts
{
  receiver: string;   // the other party's profileId
  text?: string;
  attachments?: { url: string; type: 'image'|'video'|'pdf'|'file' }[];
}
```
**Ack**: same shape as `group:send-message`. On success broadcasts `message:new`.

### `seen`
Mark every unread message in a **direct** chat as seen by the caller. No-op for group/worker/client chats.
**Payload**: `{ chatId: string }` (or `{ conversationId: string }` — either key works).
No ack. On success (≥1 message updated) broadcasts `message:seen`. Errors → `socket-error` only.

---

## 7. Socket.IO — server → client events

### `onlineUser`
Broadcast to **everyone** (`io.emit`) on every connect/disconnect.
**Payload**: `string[]` — currently online `profileId`s (in-memory, resets on restart).

### `socket-error`
Sent to the one socket that caused it, never broadcast.
```ts
{ code: number; message: string; type: 'validation'|'database'|'auth'|'general'|'server'; details?: unknown; }
```

### `group:new-message`
A message was created in a `group`, `worker`, or `client` chat.
**Payload**: full `ChatMessage` (§4), `sender` populated.
**Delivered to**: `group:<chatId>`, `role:manager`, the chat's client's personal room (skipped for `worker` chats — no client), every assigned worker's personal room (skipped for `client` chats — no workers). You receive this whether or not you called `group:join` (personal-room delivery guarantees it).

### `message:new`
Same as above but for `direct` chats. **Delivered to**: `group:<chatId>`, the client's room, the worker's room — **not** `role:manager` (direct chats are private).

### `group:message-deleted`
`{ _id: string; chat: string }` — id of the deleted message, not the full message. Same targets as `group:new-message` (includes `role:manager`).

### `message:deleted`
Same shape, for `direct` chats. Same targets as `message:new` (excludes `role:manager`).

### `message:seen`
`{ chatId: string }`, fired after a `seen` request actually updated ≥1 message. **Delivered to**: the client's and worker's personal rooms (not the group room).

### `group:typing` / `group:stop-typing`
Server-relayed versions of the client-sent events (same names, reused).
`group:typing` → `{ groupId: string; userId: string; name?: string }` (`userId` = **User account id**, not profile id).
`group:stop-typing` → `{ groupId: string; userId: string }`.
**Delivered to**: everyone else currently in `group:<groupId>` (sender excluded).

### `group:added`
A worker was added to a `group` chat — fired from the cleaning-plan assignment flow, not a client-sent event.
**Payload**: `{ _id: string; name: string | null; cleaning_plan: string | null }`.
**Delivered to**: the newly-added worker's personal room only (one emit per worker if several added at once).

### `group:removed`
A worker was removed from a `group` chat.
**Payload**: `{ _id: string; cleaning_plan: string | null }`.
**Delivered to**: the removed worker's personal room only.

### `group:renamed`
Fired from `PATCH /chat/{id}/rename` (§2.3), not a socket event.
**Payload**: `{ _id: string; name: string }`.
**Delivered to**: `group:<chatId>`, `role:manager`, the client's room, every worker's room.

### `worker-chat:created`
Fired right after a worker profile is created (`POST /worker/create-worker`) — the `type:'worker'` chat now exists. Lets already-connected managers refresh their chat list live instead of polling.
**Payload**: `{ _id: string; worker: string }`.
**Delivered to**: `role:manager` only (the worker isn't notified — they already know; their app just calls `GET /chat/my-chats` on load).

### `client-chat:created`
Mirrors `worker-chat:created` exactly, for clients. Fired right after `POST /client/create-client`.
**Payload**: `{ _id: string; client: string }`.
**Delivered to**: `role:manager` only.

---

## 8. Things worth knowing before integrating

- **`sender`/`userId` on messages and typing events is the User account id**, while chat membership (`chat.client`/`chat.workers`) is stored as **profile ids** — different id spaces on purpose. The JWT gives you both (`id` = account id, `profileId` = profile id).
- **All socket emits triggered from REST handlers are best-effort** (e.g. `group:renamed`, `group:message-deleted` from `DELETE /chat-message/{id}`) — wrapped in try/catch, swallowed if the socket layer isn't initialized. The HTTP response is authoritative; the socket push is a convenience for already-connected clients.
- **`group:join` isn't required to receive messages** — only join for typing indicators.
- **A manager's `role:manager` join is automatic on connect** — no need to `group:join` every group/worker/client chat to get `group:new-message`/`group:message-deleted`/`group:renamed`/`worker-chat:created`/`client-chat:created`.
- **`worker`/`client` chat names are never stored** — always computed per-viewer at read time (`display_name`). If your UI needs a name right after `group:new-message`/`worker-chat:created`/`client-chat:created` fires, derive it client-side with the same rule (§1) rather than expecting it in the event payload.
- **Worker/client chats are deactivated (`is_active:false`), not deleted**, when the worker/client is soft-deleted — same lifecycle as group chats when their cleaning plan is deleted. History isn't erased; the chat just stops appearing in `GET /chat/my-chats`.
- The old `GET /chat/my-groups` and `GET /chat/my-direct-chats` endpoints have been **removed** — use `GET /chat/my-chats` for everything.
