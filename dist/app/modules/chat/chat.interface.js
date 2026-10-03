"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_TYPES = void 0;
// 'group'  — one per cleaning plan: client + every currently-assigned worker,
//            every manager implicitly a member.
// 'direct' — a 1:1 client<->worker chat.
// 'worker' — one per worker (created automatically when the worker profile is
//            created): that one worker + every manager implicitly a member,
//            no client involved. Its display name is role-dependent (see
//            chat.services.ts's getMyChatsFromDB / toDisplayName) rather than
//            a single stored string: a worker viewing it sees "Managers", a
//            manager viewing it sees the worker's name.
// 'client' — one per client (created automatically when the client profile is
//            created): that one client + every manager implicitly a member,
//            no workers involved. Mirrors 'worker' exactly, other than which
//            side is singular: display name is role-dependent — a client
//            viewing it sees "Manager", a manager viewing it sees the
//            client's name.
exports.CHAT_TYPES = ['group', 'direct', 'worker', 'client'];
