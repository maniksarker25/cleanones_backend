"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const notification_enum_1 = require("./notification.enum");
const notificationSchema = new mongoose_1.Schema({
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
        entity: { type: String, enum: Object.values(notification_enum_1.NOTIFICATION_ENTITY) },
        action: { type: String, enum: Object.values(notification_enum_1.NOTIFICATION_ACTION) },
        entityId: { type: mongoose_1.Schema.Types.ObjectId },
        meta: {
            type: mongoose_1.Schema.Types.Mixed,
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
}, {
    timestamps: true,
});
notificationSchema.index({ receiver: 1, isRead: 1 });
notificationSchema.index({ receiver: 1, createdAt: -1 });
//  auto delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
const Notification = (0, mongoose_1.model)('Notification', notificationSchema);
exports.default = Notification;
