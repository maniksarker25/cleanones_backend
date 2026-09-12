import { Types } from 'mongoose';

export interface IMessage {
    text?: string;
    imageUrl?: string[];
    videoUrl?: string[];
    pdfUrl?: string[];
    msgByUserId: Types.ObjectId;
    msgByUserModel: 'Customer' | 'Provider';
    seen?: boolean;
    conversationId: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
    receiverId: Types.ObjectId;
    receiverModel: 'Customer' | 'Provider';
}
