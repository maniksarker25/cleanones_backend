import { Schema, model } from 'mongoose';
import {
    ATTACHMENT_TYPES,
    CHAT_MESSAGE_SENDER_ROLES,
    TChatMessage,
} from './chat_message.interface';

const attachmentSchema = new Schema(
    {
        url: { type: String, required: true },
        type: { type: String, enum: ATTACHMENT_TYPES, required: true },
    },
    { _id: false }
);

const chatMessageSchema = new Schema<TChatMessage>(
    {
        chat: {
            type: Schema.Types.ObjectId,
            ref: 'Chat',
            required: true,
            index: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        sender_role: {
            type: String,
            enum: CHAT_MESSAGE_SENDER_ROLES,
            required: true,
        },
        text: {
            type: String,
            default: '',
        },
        attachments: {
            type: [attachmentSchema],
            default: [],
        },
        seen: {
            type: Boolean,
            default: false,
        },
        is_deleted: {
            type: Boolean,
            default: false,
        },
        deleted_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

chatMessageSchema.index({ chat: 1, createdAt: -1 });

export const ChatMessage = model<TChatMessage>(
    'ChatMessage',
    chatMessageSchema
);
