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
            default: null,
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
        timestamps: true,
        versionKey: false,
    }
);

// getMyChatsFromDB's three query shapes, one compound index each, following
// the equality-sort-range order so Mongo can satisfy the filter AND the
// last_message_at sort from the index itself (no in-memory sort). The
// leading field alone (client / workers / is_active+type) still serves any
// simpler equality-only lookup via the standard index-prefix rule, so these
// replace rather than supplement the old single-field client/workers indexes.
chatSchema.index({ client: 1, is_active: 1, last_message_at: -1 });
chatSchema.index({ workers: 1, is_active: 1, last_message_at: -1 });
// Manager's list spans every group/worker/client chat in the system (not
// scoped to one client/worker), so this is the query most likely to degrade
// without its own index as the business grows.
chatSchema.index({ is_active: 1, type: 1, last_message_at: -1 });

chatSchema.index(
    { cleaning_plan: 1 },
    { unique: true, partialFilterExpression: { type: 'group' } }
);
chatSchema.index(
    { participant_key: 1 },
    { unique: true, partialFilterExpression: { type: 'direct' } }
);
// One worker<->managers chat per worker. `workers` always holds exactly one
// id for this type, so a unique (multikey) index on it enforces "at most one
// type: 'worker' document per worker" the same way participant_key does for
// direct chats.
chatSchema.index(
    { workers: 1 },
    { unique: true, partialFilterExpression: { type: 'worker' } }
);
// One client<->managers chat per client — mirrors the 'worker' index above.
chatSchema.index(
    { client: 1 },
    { unique: true, partialFilterExpression: { type: 'client' } }
);

export const Chat = model<TChat>('Chat', chatSchema);
