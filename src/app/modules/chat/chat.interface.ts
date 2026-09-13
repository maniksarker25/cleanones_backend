import { Types } from 'mongoose';

export const CHAT_TYPES = ['group', 'direct'] as const;
export type TChatType = (typeof CHAT_TYPES)[number];

export interface TChat {
    _id?: string;
    type: TChatType;

    // group chats (type: 'group') — one per cleaning plan
    cleaning_plan?: Types.ObjectId | null;
    name?: string | null;

    // shared by both types: exactly who's in the chat.
    // group: client + every currently-assigned worker.
    // direct: the one client + the one worker (a 1:1 chat is just a group
    // chat with a single worker and no plan/name) — reusing these two
    // fields instead of a separate `participants` array keeps membership
    // checks identical for both chat types.
    client: Types.ObjectId;
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
