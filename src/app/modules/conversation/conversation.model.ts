import { Schema, model } from 'mongoose';
import { IConversation } from './conversation.interface';

const conversationSchema = new Schema<IConversation>(
    {
        participants: [
            {
                type: Schema.Types.ObjectId,
                required: true,
                refPath: 'participantsModel',
            },
        ],
        participantsModel: [
            {
                type: String,
                required: true,
                enum: ['Customer', 'Provider'],
            },
        ],

        participantKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },

        // Add this for sorting conversation lists faster
        lastMessageAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation = model<IConversation>('Conversation', conversationSchema);

export default Conversation;
