import { model, Schema } from 'mongoose';
import { NOTIFICATION_ACTION, NOTIFICATION_ENTITY } from './notification.enum';
import { INotification } from './notification.interface';

const notificationSchema = new Schema(
    {
        receiver: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            required: true,
            index: true,
        },

        title: {
            type: String,
            required: true,
        },

        message: {
            type: String,
            required: true,
        },

        data: {
            entity: { type: String, enum: Object.values(NOTIFICATION_ENTITY) },
            action: { type: String, enum: Object.values(NOTIFICATION_ACTION) },
            entityId: { type: Schema.Types.ObjectId },
            meta: {
                type: Schema.Types.Mixed,
            },
        },

        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },

        readAt: {
            type: Date,
        },

        isSeen: {
            type: Boolean,
            default: false,
        },

        seenAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({ receiver: 1, isRead: 1 });
notificationSchema.index({ receiver: 1, createdAt: -1 });

//  auto delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Notification = model<INotification>('Notification', notificationSchema);
export default Notification;
