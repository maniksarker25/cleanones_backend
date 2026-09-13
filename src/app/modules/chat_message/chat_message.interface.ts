import { Types } from 'mongoose';

export const CHAT_MESSAGE_SENDER_ROLES = ['client', 'worker', 'manager'] as const;
export type TChatMessageSenderRole = (typeof CHAT_MESSAGE_SENDER_ROLES)[number];

export const ATTACHMENT_TYPES = ['image', 'video', 'pdf', 'file'] as const;
export type TAttachmentType = (typeof ATTACHMENT_TYPES)[number];

export interface TAttachment {
    url: string;
    type: TAttachmentType;
}

export interface TChatMessage {
    _id?: string;
    chat: Types.ObjectId;
    sender: Types.ObjectId;
    sender_role: TChatMessageSenderRole;
    text: string;
    attachments: TAttachment[];
    // Only meaningful for direct (1:1) chats — group chats have more than
    // one recipient, so a single boolean can't represent "seen" for them.
    seen: boolean;
    is_deleted: boolean;
    deleted_at?: Date | null;
    created_at?: Date;
    updated_at?: Date;
}
