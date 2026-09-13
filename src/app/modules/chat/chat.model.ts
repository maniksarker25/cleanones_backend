import { Schema, model } from 'mongoose';
import { CHAT_TYPES, TChat } from './chat.interface';

const chatSchema = new Schema<TChat>(
    {
        type: {
            type: String,
            enum: CHAT_TYPES,
            required: true,
        },
        cleaning_plan: {
            type: Schema.Types.ObjectId,
            ref: 'CleaningPlan',
            default: null,
        },
        name: {
            type: String,
            trim: true,
            default: null,
        },
        client: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        workers: {
            type: [Schema.Types.ObjectId],
            ref: 'Worker',
            default: [],
        },
        participant_key: {
            type: String,
            default: null,
        },
        last_message: {
            type: Schema.Types.ObjectId,
            ref: 'ChatMessage',
            default: null,
        },
        last_message_at: {
            type: Date,
            default: null,
        },
        last_updated_by: {
            type: Schema.Types.ObjectId,
            ref: 'Manager',
            default: null,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

chatSchema.index({ workers: 1 });
chatSchema.index(
    { cleaning_plan: 1 },
    { unique: true, partialFilterExpression: { type: 'group' } }
);
chatSchema.index(
    { participant_key: 1 },
    { unique: true, partialFilterExpression: { type: 'direct' } }
);

export const Chat = model<TChat>('Chat', chatSchema);
