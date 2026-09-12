/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY_TYPE,
} from './notification.enum';

export interface INotification {
    receiver: string;

    type: (typeof ENUM_NOTIFICATION_TYPE)[keyof typeof ENUM_NOTIFICATION_TYPE];

    title: string;
    message: string;

    data?: {
        entity: NOTIFICATION_ENTITY_TYPE; // ORDER | SHIFT | PAYMENT
        action: (typeof NOTIFICATION_ACTION)[keyof typeof NOTIFICATION_ACTION]; // VIEW | LIST | ACCEPT
        entityId?: Types.ObjectId;

        meta?: Record<string, any>;
    };

    isRead: boolean;
    readAt?: Date;

    createdAt?: Date;
    updatedAt?: Date;
}
