# Notification System — How It Works

This is the architecture reference: how a notification gets from "something happened" to "the right person saw it." For the REST/socket contract a frontend integrates against, see `NOTIFICATION_API.md` in the project root instead.

## The short version

1. Something happens in the app (a cleaning plan is created, a worker checks in, an additional task is approved...).
2. That service function fires a typed, in-process event (`emitAppEvent`).
3. A listener for that event decides who needs to know, and calls `NotificationService.sendNotification()` once per recipient.
4. `sendNotification()` always saves a `Notification` row, then delivers it **either** over the already-open Socket.IO connection (if the recipient is online right now) **or** as a OneSignal push to their phone (if they're not) — never both, decided automatically per call.
5. Chat messages are the one exception — they skip this whole pipeline and use a separate, simpler push-only path. See "Why chat is different" below.

## The pieces, in order

### 1. Domain events — `src/app/events/eventEmitter.ts`

A plain Node `EventEmitter` (`appEventEmitter`), wrapped with two typed helpers so emitting/listening is checked at compile time instead of being stringly-typed:

```ts
emitAppEvent('cleaning_plan.created', { planId, title, clientId, managerId, assignedWorkerIds });
onAppEvent('cleaning_plan.created', async (payload) => { ... });
```

`AppEventPayloadMap` in that same file is the single source of truth for every event name and its exact payload shape — add a new event by adding one line there, one payload interface, and a listener. Currently defined events:

| Event | Fired from | Payload |
|---|---|---|
| `cleaning_plan.created` | `cleaning_plan.services.ts` → `createCleaningPlanIntoDB` | `{ planId, title, clientId, managerId, assignedWorkerIds }` |
| `cleaning_plan.worker_assigned` | `updateCleaningPlanIntoDB`, `assignWorkersToPlan` | `{ planId, title, addedWorkerIds }` — only the *newly*-added workers, diffed against the roster before the update |
| `cleaning_plan.worker_removed` | same two functions | `{ planId, title, removedWorkerIds }` |
| `cleaning_plan.deleted` | `deleteCleaningPlanFromDB` | `{ planId, title, clientId, workerIds }` |
| `additional_task.created` | `additional_task.services.ts` → `createAdditionalTaskIntoDB` | `{ taskId, planId, clientId, name }` — only fires when a **client** requested it; a manager creating one is auto-approved, so there's nothing to notify managers about |
| `additional_task.approved` / `.rejected` | `approveAdditionalTaskIntoDB` | `{ taskId, planId, clientId, name }` |
| `shift.checked_in` / `.checked_out` | `shift.services.ts` → `checkInToShift` / `checkOutFromShift` | `{ shiftId, planId, workerId, at }` |
| `shift.completed` | `maybeAutoCompleteShift`, gated on the status actually flipping (never re-fires) | `{ shiftId, planId, clientId }` |
| `chat.message_received` | `chat_message.services.ts` → `createChatMessage` | `{ chatId, chatType, senderUserId, recipientProfileIds, preview }` — see "Why chat is different" |

### 2. Listeners — `src/app/events/listeners/*.listener.ts`

One file per domain area (`cleaning_plan`, `additional_task`, `shift`, `chat`), each calling `onAppEvent(...)` to register handlers. They're loaded once, at server startup, via the barrel `src/app/events/listeners/index.ts`, which `app.ts` imports for its side effect:

```ts
// app.ts
import './app/events/listeners';
```

A listener's job is entirely "who gets notified, with what text" — resolving the actual delivery (socket vs. push) is `sendNotification()`'s job, not the listener's.

**Manager fan-out.** There's no persisted "which managers care about this plan" list anywhere in the app — manager access is role-based everywhere (see the chat system's `ensureChatAccessOrThrow`). Notifications follow the same rule: `additional_task.created` and the `shift.*` events query **every** `Manager` document and send each one their own `Notification` row (own read/seen state), rather than one shared row. This is a full collection scan per event — fine at current scale, worth indexing/revisiting if the number of managers grows large.

**Errors don't propagate.** `appEventEmitter.emit()` doesn't await async listeners, so every `sendNotification()` call inside a listener is wrapped in `.catch(err => errorLogger.error(...))`. A notification failure (bad receiver id, OneSignal down, whatever) never fails the request that triggered it — the cleaning plan still gets created even if notifying about it fails.

### 3. Delivery — `notification.services.ts`'s `sendNotification()`

```
                    ┌─ online? ──yes──▶ socket 'notification' event to <profileId> room
Notification.create ┤
   (always)         └─ no ──▶ look up Device rows for this user ──▶ OneSignal push
```

- **"Online"** = `isUserOnline(profileId)`, backed by the in-memory `onlineUsers` Set in `src/app/socket/socket.ts`, populated on every socket connect/disconnect. Not persisted — resets on server restart, and doesn't reflect who was online before a crash.
- **The socket emit is best-effort**, wrapped in try/catch — if the socket server isn't initialized (scripts, tests) it silently falls through to the push branch instead of throwing.
- **The push branch** looks up `Device` rows for that user (registered via `upsertDevice` on login/signup when the client passes a `playerId`) and calls `sendPushNotification()` (`notification/helpers/sendPushNotification.ts`), which POSTs to the OneSignal REST API.
- **The `Notification` row is always written**, regardless of which delivery path fires — `GET /notification/get-notifications` is the source of truth for "what happened," independent of whether the user was online at the time.

### 4. Why chat is different

Chat messages do **not** go through `sendNotification()` at all. A busy group chat would otherwise:
- flood the notification list with one row per message, burying real events like "plan created" or "task approved", and
- send one separate OS push per message to an offline recipient — a wall of tray notifications instead of one.

Instead, `chat.message_received` is handled by a dedicated `sendChatPushNotification()`:
- **No `Notification` row** — chat already has its own history and unread-tracking (`ChatMessage` + the `seen` mechanism), so there's nothing worth duplicating into the generic feed.
- **No socket `notification` event** — realtime delivery for chat already happens directly in `chat_message.services.ts` (`group:new-message` / `message:new`), independent of this system entirely.
- **Online recipients get nothing further** — the chat socket event already reached them.
- **Offline recipients get a OneSignal push with `collapse_id`/`android_group` set to the chat's id** — a second message before the first push is seen *replaces* it in the OS tray instead of stacking, so someone offline for an hour gets one "new messages" notification, not fifty.
- **Managers are excluded from chat push entirely**, even for group/worker/client-type chats where they're implicit members — they already get full realtime coverage via the `role:manager` socket room, and pushing every manager's phone for every message in every chat would be pure noise.

## Data model

`Notification` (`notification.model.ts`):
- `receiver: string` — a Client/Worker/Manager/Admin `profileId`, **or** the literal string `'admin'` for the superAdmin bucket (see "The `'admin'` special case" below). Plain string, not an ObjectId ref — no populate.
- `type`, `data.entity`, `data.action` — see `notification.enum.ts` (`ENUM_NOTIFICATION_TYPE`, `NOTIFICATION_ENTITY`, `NOTIFICATION_ACTION`). Loosely typed in the schema (no enum constraint on `type` itself), so adding a new type is additive and safe.
- `data.entityId` / `data.meta` — whatever the emitting listener wants to attach for deep-linking (e.g. `{ planId }`).
- `isRead`/`readAt`, `isSeen`/`isSeenAt` — `isRead` is actually used (`PATCH /see-notifications` sets it); `isSeen`/`seenAt` exist on the schema but nothing currently sets them — reserved for a future "seen vs. read" distinction (e.g. seen = appeared in the list, read = tapped open).
- **Auto-deletes after 30 days** — a TTL index on `createdAt`. Notifications are not meant to be a permanent audit log.

### The `'admin'` special case

`superAdmin`-role users share one notification bucket (`receiver: 'admin'`) rather than each having their own — `getAllNotificationFromDB`, `seeNotification`, and `deleteNotification` all branch on `role === superAdmin` to use the literal string `'admin'` instead of `profileId`. Every other role (`admin`, `manager`, `client`, `worker`) uses their own `profileId` normally. This is pre-existing behavior, unrelated to the domain-event work above — noted here since it's easy to miss when reading the service code.

## Registering for push (mobile/web clients)

A client calls `upsertDevice(userId, playerId, platform)` (`device.service.ts`) — currently wired in on login and sign-up, when the request includes a `playerId` (the OneSignal player id from the device SDK). Devices are matched by `playerId` (unique), so re-registering the same device just refreshes `lastActiveAt`/`isActive` rather than duplicating. A weekly cron (`device.service.ts`, Sunday 2am) deletes devices that have been inactive for 30+ days.

## File map

```
src/app/events/
  eventEmitter.ts              typed event bus (AppEventPayloadMap, emitAppEvent, onAppEvent)
  listeners/
    index.ts                   barrel — imported once by app.ts for the side effect
    cleaning_plan.listener.ts
    additional_task.listener.ts
    shift.listener.ts
    chat.listener.ts           the one that calls sendChatPushNotification, not sendNotification

src/app/modules/notification/
  notification.model.ts
  notification.interface.ts
  notification.enum.ts
  notification.services.ts     sendNotification, sendChatPushNotification, list/see/delete
  notification.controller.ts
  notification.routes.ts
  helpers/sendPushNotification.ts   raw OneSignal REST call, collapseId support

src/app/modules/device/
  device.model.ts
  device.service.ts            upsertDevice/deactivateDevice, weekly cleanup cron

src/app/socket/
  socket.ts                    onlineUsers set, isUserOnline, getIO — what "online" means
```

## Extending this

Adding a new notification-worthy event:
1. Add the event name + payload interface to `AppEventPayloadMap` in `eventEmitter.ts`.
2. Add (or reuse) a listener file in `events/listeners/`, call `onAppEvent(...)`, resolve receiver(s), call `NotificationService.sendNotification(...)`.
3. Register the listener file in `events/listeners/index.ts` if it's new.
4. Call `emitAppEvent(...)` from the service function where the real thing happens — right after the write succeeds, not before.
5. Add the type/entity to `notification.enum.ts` if it doesn't already fit an existing one.

Don't route high-frequency, per-item events (anything that could fire many times in quick succession for the same recipient, the way chat messages do) through `sendNotification()` directly — follow the `sendChatPushNotification` pattern instead (no DB row, collapsed push) to avoid flooding both the notification list and the recipient's OS tray.
