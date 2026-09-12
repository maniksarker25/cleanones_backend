import { Schema, model } from 'mongoose';
import { IMessage } from './message.interface';

const messageSchema = new Schema<IMessage>(
    {
        text: { type: String, default: '' },
        imageUrl: { type: [String], default: [] },
        videoUrl: { type: [String], default: [] },
        pdfUrl: { type: [String], default: [] },

        msgByUserId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'msgByUserModel',
        },
        msgByUserModel: {
            type: String,
            required: true,
            enum: ['Customer', 'Provider'],
        },

        receiverId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'receiverModel',
        },
        receiverModel: {
            type: String,
            required: true,
            enum: ['Customer', 'Provider'],
        },

        seen: { type: Boolean, default: false },

        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
    },
    { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, receiverId: 1, seen: 1 });
messageSchema.index({ receiverId: 1, seen: 1, createdAt: -1 });

const Message = model<IMessage>('Message', messageSchema);

export default Message;
