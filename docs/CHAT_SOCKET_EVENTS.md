# Chat — Socket.IO Event Reference

REST (`/api/v1/chat`, `/api/v1/chat-message`) only covers listing chats/messages, reading chat members, renaming a group, and soft-deleting a message — see the **Chats** and **Chat messages** tags in the Swagger UI. **Every message is created over Socket.IO** — there is no REST `POST` for creating a message. This document is the realtime event contract; OpenAPI/Swagger has no native way to describe WebSocket events, so it lives here instead (the Swagger UI's tag descriptions and the `Chat`/`ChatMessage` schema descriptions point back to this file).

## Connecting

Default Socket.IO path (`/socket.io`), default namespace (`/`), same server as the REST API. No custom `path` option.

**Auth handshake** (on `connection`): send the access token as either:
```js
io(url, { auth: { token: accessToken } })
// or
io(url, { query: { token: accessToken } })
```
The server verifies it with the same JWT secret as REST (`jwt.verify(token, config.jwt_access_secret)`), expecting a payload with `profileId`, `id` (User account id) and `role`. Missing/invalid token, or a payload missing `profileId` → the server calls `socket.disconnect()` immediately, no error event.

**On successful connection**, the server automatically:
- `socket.join(profileId)` — every connected user has a personal room named after their own `profileId`. This is how direct pushes (`io.to(profileId)`) reach a specific user regardless of which chat room(s) they've joined.
- If `role === 'manager'`, also `socket.join('role:manager')` — lets any group-chat broadcast reach all connected managers without each one explicitly joining every group.
- Adds the user to an in-memory online-users set and broadcasts `onlineUser` to everyone (see below). This set is **not persisted** — it resets on server restart and does not reflect who was online before a crash/deploy.

**Rooms in play**, for reference:
| Room | Who's in it | Purpose |
| --- | --- | --- |
| `<profileId>` | one user | Personal delivery target |
| `role:manager` | every connected manager | Group-, worker-, and client-chat visibility for managers |
| `group:<chatId>` | whoever called `group:join` for that chat | Live typing indicators + is the room `group:*` broadcasts target (works for all four chat types — the name is historical, any `Chat` document uses it) |

**Four chat types**, for reference (`Chat.type` in the data model):
- `'group'` — one per cleaning plan; client + every currently-assigned worker; every manager implicitly a member.
- `'direct'` — a 1:1 client↔worker chat.
- `'worker'` — one per worker, created automatically right when the worker profile is created (see `worker-chat:created` below); that one worker + every manager implicitly a member, no client involved. Its name is **role-dependent, not stored**: a worker viewing it sees `"Managers"`, a manager viewing it sees the worker's own name (see the `display_name` field on `GET /chat/my-chats` / `GET /chat/{id}/members` in the REST docs).
- `'client'` — one per client, created automatically right when the client profile is created (see `client-chat:created` below); that one client + every manager implicitly a member, no workers involved. Exact mirror of `'worker'`, other than which side is singular: a client viewing it sees `"Manager"` (singular), a manager viewing it sees the client's own name.

---

## Client → Server events

### `group:join`
Join a chat's realtime room (required before typing indicators work for that chat; message delivery itself uses personal rooms so this isn't strictly required just to receive `*:new-message`, but you should still join to receive typing events).

**Payload**: `{ groupId: string }` (a Chat `_id` — any of the four types, despite the name).

**No ack callback.** On failure (missing `groupId`, or `ensureChatAccessOrThrow` rejects — same access rule as REST: manager auto-passes for `type: 'group'`, `type: 'worker'` and `type: 'client'`, otherwise you must be the chat's `client` or in its `workers`), the server emits `socket-error` back to you instead.

### `group:leave`
**Payload**: `{ groupId: string }`. No ack, no error on missing `groupId` (just a no-op).

### `group:send-message`
Send a message into any chat you're already a member of — group, direct, worker, or client (works for all four — despite the `group:` prefix, this is the general-purpose send for any chat you know the id of; use plain `send-message` instead only when you need the server to find-or-create a direct chat for you from a `receiver` id — see below).

**Payload**:
```ts
{
  groupId: string;        // Chat _id
  text?: string;           // at least one of text/attachments required
  attachments?: { url: string; type: 'image' | 'video' | 'pdf' | 'file' }[];
}
```

**Ack callback**: `(response: { success: true; data: ChatMessage } | { success: false; message: string }) => void`.

On success, also broadcasts `group:new-message` (group, worker, or client chats) or `message:new` (direct chats) to everyone in the chat — see server→client section. On failure, both the ack callback *and* a `socket-error` event fire.

### `group:delete-message`
Soft-deletes a message (same rule as `DELETE /chat-message/{id}`: original sender, or a manager on a group, worker, or client chat).

**Payload**: `{ messageId: string }`.

**Ack callback**: same shape as `group:send-message`. On success, also broadcasts `group:message-deleted` (group/worker/client) or `message:deleted` (direct).

### `group:typing`
**Payload**: `{ groupId: string; name: string }`. No ack. Relayed to everyone else in `group:<groupId>` (see server→client `group:typing`) — the sender does not receive their own relay.

### `group:stop-typing`
**Payload**: `{ groupId: string }`. No ack. Relayed the same way.

### `send-message`
Start-or-continue a **direct** chat by the other party's `profileId`, without needing to already know the `Chat` id. **Client and worker roles only** — a manager calling this gets an error (managers don't have direct chats).

**Payload**:
```ts
{
  receiver: string;        // the other party's profileId (client calls with a worker's id, worker calls with a client's id)
  text?: string;
  attachments?: { url: string; type: 'image' | 'video' | 'pdf' | 'file' }[];
}
```

**Ack callback**: same shape as `group:send-message`. Internally: finds-or-creates the direct `Chat` (idempotent, keyed by a sorted `clientId:workerId` string) via `chatServices.findOrCreateDirectChat`, then creates the message on it. Broadcasts `message:new` on success.

### `seen`
Mark every unread message in a **direct** chat as seen by the caller. No-op for group chats (the `seen` field only has meaning for 1:1 chats).

**Payload**: `{ chatId: string }` (or `{ conversationId: string }` — either key works, `chatId` is checked first).

No ack callback. On success (≥1 message actually updated) broadcasts `message:seen`. Errors emit `socket-error` only (nothing thrown back to the caller besides that).

---

## Server → Client events

### `onlineUser`
Broadcast to **everyone** (`io.emit`, not room-scoped) whenever anyone connects or disconnects.

**Payload**: `string[]` — the full current list of online `profileId`s (from the in-memory set).

### `socket-error`
Sent to the one socket that caused it (never broadcast).

**Payload**:
```ts
{
  code: number;                                              // usually the underlying error's statusCode, or 500
  message: string;
  type: 'validation' | 'database' | 'auth' | 'general' | 'server';
  details?: unknown;
}
```

### `group:new-message`
A message was created in a **group, worker, or client** chat.

**Payload**: the full `ChatMessage` document (see the `ChatMessage` schema in Swagger), with `sender` populated (`full_name`, `profile_photo`, `email`).

**Delivered to**: `group:<chatId>` room, `role:manager` room, the chat's client's personal room (worker chats have no client, so this is skipped for them), and every assigned worker's personal room (client chats have no workers, so this is skipped for them). (So you receive it whether or not you've called `group:join` — the personal-room delivery guarantees that; joining the group room is only needed for typing indicators.)

### `message:new`
Same as `group:new-message`, but for a **direct** chat. **Delivered to**: `group:<chatId>` room, the client's personal room, and the worker's personal room — **not** `role:manager` (direct chats are private between the two parties).

**Offline recipients**: these two events only reach a connected socket. Whichever of the chat's client/workers is *not* currently online instead gets a OneSignal push (`sendChatPushNotification`, `src/app/modules/notification/notification.services.ts`) — deliberately not the `notification` event and not a `Notification` DB row (see that section below for why). Every push for the same chat shares a `collapse_id`/`android_group` equal to the chat's id, so several messages while someone's offline collapse into one tray entry instead of stacking. Managers are excluded from this push entirely (they already get full realtime coverage via `role:manager`, and pushing every manager's device for every message in every chat would be pure noise).

### `group:message-deleted`
A message in a **group, worker, or client** chat was soft-deleted.

**Payload**: `{ _id: string; chat: string }` (the message id and its chat id — not the full message).

**Delivered to**: same targets as `group:new-message` (includes `role:manager`).

### `message:deleted`
Same as above, for a **direct** chat. **Delivered to**: same targets as `message:new` (excludes `role:manager`).

### `message:seen`
Fired after a `seen` request actually updated ≥1 message in a direct chat.

**Payload**: `{ chatId: string }`.

**Delivered to**: the chat's client's personal room and the worker's personal room (not the `group:<chatId>` room).

### `group:typing` / `group:stop-typing`
Relayed versions of the client-sent events (same event names, reused for the server→client direction).

**Payload** (`group:typing`): `{ groupId: string; userId: string; name?: string }` — `userId` is the sender's **User account id** (`currentUserId`), not their profile id.
**Payload** (`group:stop-typing`): `{ groupId: string; userId: string }`.

**Delivered to**: everyone else currently in `group:<groupId>` (the sender's own socket is excluded via `socket.to(...)`).

### `group:added`
A worker was added to a group chat (fired from the cleaning-plan assignment flow, not from `handleChat.ts` directly — included here since it's part of the same chat realtime surface).

**Payload**: `{ _id: string; name: string | null; cleaning_plan: string | null }`.

**Delivered to**: the newly-added worker's personal room only (`io.to(workerId)`), one emit per worker if several are added at once.

### `group:removed`
A worker was removed from a group chat.

**Payload**: `{ _id: string; cleaning_plan: string | null }`.

**Delivered to**: the removed worker's personal room only.

### `group:renamed`
Fired from the REST `PATCH /chat/{id}/rename` endpoint (not from a socket event — still pushed over the socket connection).

**Payload**: `{ _id: string; name: string }`.

**Delivered to**: `group:<chatId>` room, `role:manager` room, the client's personal room, and every worker's personal room.

### `worker-chat:created`
Fired when a worker's `type: 'worker'` chat with managers is created — right after the worker profile itself is created (`POST /worker/create-worker`), not from a client-sent socket event. Lets already-connected managers pick up the new chat live instead of having to poll `GET /chat/my-chats`.

**Payload**: `{ _id: string; worker: string }`.

**Delivered to**: `role:manager` room only (the worker isn't notified over this event — they already know they were just created; their app can just call `GET /chat/my-chats` on first load, which will include this chat).

### `client-chat:created`
Mirrors `worker-chat:created` exactly. Fired when a client's `type: 'client'` chat with managers is created — right after the client profile itself is created (`POST /client/create-client`).

**Payload**: `{ _id: string; client: string }`.

**Delivered to**: `role:manager` room only.

---

## Other server → client events (not chat-specific)

These fire on the same connection but aren't part of the chat feature — grouped here rather than in a separate doc since it's the same socket, the same auth handshake, and the same personal-room delivery mechanism (`<profileId>`) described above.

### `notification`
A general app notification — cleaning plan created / worker assigned / worker removed / plan deleted, additional task created / approved / rejected, shift checked in / checked out / completed. Fired from `NotificationService.sendNotification()` (`src/app/modules/notification/notification.services.ts`), itself triggered by the domain-event listeners in `src/app/events/listeners/*.listener.ts`.

**Payload**: the created `Notification` document (see the `Notification` schema in Swagger — `type`, `title`, `message`, `data.entity`/`data.action`/`data.entityId`/`data.meta`).

**Delivered to**: the receiver's own personal room (`io.to(profileId)`) only — **only if they're currently online**. If they're not, `sendNotification()` sends a OneSignal push to their registered devices instead and this socket event never fires for that particular notification; the `Notification` row is created in the database either way, so `GET /notification/get-notifications` always has it regardless of which delivery path was used.

> **Chat messages are NOT covered by this event.** They deliberately skip both the `Notification` collection and this socket event entirely — a busy chat would otherwise flood the notification list with one row per message. See the "Offline recipients" note under `message:new`/`group:new-message` above for how chat push actually works (`sendChatPushNotification`, collapsed per-chat, no DB row, no `notification` event).

## Things worth knowing before integrating

- **`sender` on a message is the User account id**, while chat membership (`chat.client` / `chat.workers`) is stored as **profile ids**. These are different id spaces on purpose — don't compare one against the other directly. The JWT payload gives you both (`id` = account id, `profileId` = profile id) so you always have whichever one a given check needs.
- **All socket emits triggered from REST handlers (e.g. `group:renamed`) are best-effort** — wrapped in try/catch, swallowed if the socket layer isn't initialized (e.g. in tests). The HTTP response never depends on the realtime push succeeding; treat the database response as authoritative and the socket event as a convenience for already-connected clients.
- **`group:join` isn't required to receive messages** — personal-room delivery (`<profileId>`) means `group:new-message`/`message:new` reach you regardless. Join only when you need typing indicators for that specific chat, or to reduce reliance on the personal-room fallback for your own UI logic.
- **A manager's own room join happens automatically** (`role:manager` on connect) — a manager does not need to call `group:join` for every group, worker, or client chat to receive `group:new-message`/`group:message-deleted`/`group:renamed`/`worker-chat:created`/`client-chat:created`, since those are also delivered to `role:manager` directly.
- **Neither a worker chat's nor a client chat's name is ever stored** — both are computed per-viewer at read time (`display_name` on `GET /chat/my-chats` and `GET /chat/{id}/members`), not pushed as part of any socket payload. If your UI needs a name for a `type: 'worker'` or `type: 'client'` chat right after `group:new-message`/`worker-chat:created`/`client-chat:created` fires, derive it client-side the same way the REST layer does (`"Managers"`/`"Manager"` if you're the worker/client, the other party's own name if you're a manager) rather than expecting the event payload to carry it.
- **Worker and client chats are deactivated (`is_active: false`), not deleted**, when the worker or client is soft-deleted — same lifecycle as group chats when their cleaning plan is deleted. A deactivated chat stops appearing in `GET /chat/my-chats` but its message history isn't erased.
