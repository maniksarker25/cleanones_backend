import { Types } from 'mongoose';

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
export const CHAT_TYPES = ['group', 'direct', 'worker', 'client'] as const;
export type TChatType = (typeof CHAT_TYPES)[number];

export interface TChat {
    _id?: string;
    type: TChatType;

    // group chats (type: 'group') — one per cleaning plan
    cleaning_plan?: Types.ObjectId | null;
    name?: string | null;

    // group/direct/client: exactly who's in the chat, alongside `workers`
    // below. 'worker' chats have no client at all (the members are the
    // worker + every manager, implicitly — see ensureChatAccessOrThrow).
    client?: Types.ObjectId | null;
    // group: every currently-assigned worker.
    // direct: the one worker (with the one client above).
    // worker: the single worker this chat belongs to (array of length 1) —
    // reusing this field instead of a new singular one keeps every
    // membership check (ensureChatAccessOrThrow, getMyChatsFromDB) identical
    // across all three chat types.
    // client: always empty — no workers involved.
    workers: Types.ObjectId[];

    // direct chats only — sorted `${clientId}:${workerId}` key so a chat
    // can be find-or-created idempotently, mirroring the old
    // Conversation.participantKey approach.
    participant_key?: string | null;

    last_message?: Types.ObjectId | null;
    last_message_at?: Date | null;
    last_updated_by?: Types.ObjectId | null;
    is_active: boolean;
}
