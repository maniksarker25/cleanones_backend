import { Types } from 'mongoose';

export interface IConversation {
    participants: Types.ObjectId[];
    participantsModel: ('Customer' | 'Provider')[];
    lastMessage?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
    participantKey?: string;
    lastMessageAt?: string;
}
