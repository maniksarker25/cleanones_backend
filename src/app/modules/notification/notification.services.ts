import { JwtPayload } from 'jsonwebtoken';
import QueryBuilder from '../../builder/QueryBuilder';
import { getIO, isUserOnline } from '../../socket/socket';
import { USER_ROLE } from '../user/user.constant';
import Notification from './notification.model';

import mongoose from 'mongoose';
import { Device } from '../device/device.model';
import sendPushNotification from './helpers/sendPushNotification';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY_TYPE,
} from './notification.enum';

export interface SendNotificationParams {
    /** Client/Worker/Manager profile id (or 'admin' for the superAdmin bucket). */
    receiver: string;
    title: string;
    message: string;
    type: ENUM_NOTIFICATION_TYPE;
    entity?: NOTIFICATION_ENTITY_TYPE;
    action?: (typeof NOTIFICATION_ACTION)[keyof typeof NOTIFICATION_ACTION];
    entityId?: string;
    meta?: Record<string, unknown>;
}
const getAllNotificationFromDB = async (
    query: Record<string, unknown>,
    user: JwtPayload
) => {
    const receiver =
        user?.role === USER_ROLE.superAdmin ? 'admin' : user?.profileId;

    const notificationQuery = new QueryBuilder(
        Notification.find({ receiver }),
        query
    )
        .search(['title'])
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await notificationQuery.modelQuery;
    const meta = await notificationQuery.countTotal();

    const unreadCount = await Notification.countDocuments({
        receiver,
        isRead: false,
    });

    return {
        meta: {
            ...meta,
            unreadCount,
        },
        result,
    };
};

const seeNotification = async (user: JwtPayload) => {
    let result;
    if (user?.role === USER_ROLE.superAdmin) {
        result = await Notification.updateMany(
            { receiver: 'admin' },
            { isRead: true },
            { runValidators: true, new: true }
        );
    }
    if (user?.role !== USER_ROLE.superAdmin) {
        result = await Notification.updateMany(
            { receiver: user?.profileId },
            { isRead: true },
            { runValidators: true, new: true }
        );
    }
    return result;
};
const seeSingleNotification = async (
    notificationId: string,
    user: JwtPayload
) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }

    const filter: Record<string, unknown> = {
        _id: new mongoose.Types.ObjectId(notificationId),
    };

    // Security: ensure user can only update their own notification
    if (user?.role === USER_ROLE.superAdmin) {
        filter.receiver = USER_ROLE.superAdmin;
    } else {
        filter.receiver = user?.profileId;
    }

    const result = await Notification.findOneAndUpdate(
        filter,
        { isRead: true },
        { new: true, runValidators: true }
    );

    return result;
};
const deleteNotification = async (notificationId: string, user: JwtPayload) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }

    const filter: Record<string, unknown> = {
        _id: new mongoose.Types.ObjectId(notificationId),
    };

    if (user?.role === USER_ROLE.superAdmin) {
        filter.receiver = 'admin';
    } else {
        filter.receiver = user?.profileId;
    }

    const result = await Notification.findOneAndDelete({
        ...filter,
    });

    return result;
};
const sendNotification = async ({
    receiver,
    title,
    message,
    type,
    entity,
    action = NOTIFICATION_ACTION.VIEW,
    entityId,
    meta = {},
}: SendNotificationParams) => {
    const notification = await Notification.create({
        receiver,
        title,
        message,
        type,
        data: {
            entity,
            action,
            entityId,
            meta,
        },
    });

    const userId = receiver.toString();

    // Realtime delivery is best-effort: the socket server may not be
    // initialized (e.g. scripts/tests), and a receiver who isn't currently
    // connected just falls through to the push branch below regardless.
    try {
        if (isUserOnline(userId)) {
            getIO().to(userId).emit('notification', notification);
            return notification;
        }
    } catch (error) {
        console.error('Realtime notification delivery failed:', error);
    }

    // Offline push via OneSignal, using whatever devices this receiver has
    // registered (see device.service.ts's upsertDevice).
    const devices = await Device.find({
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
    }).select('playerId');

    const playerIds = devices.map((d) => d.playerId).filter(Boolean);
    if (playerIds.length > 0) {
        await sendPushNotification({
            playerIds,
            message,
            heading: title,
            data: {
                entity,
                action,
                entityId,
                ...meta,
            },
        });
    }

    return notification;
};

export interface SendChatPushNotificationParams {
    /** Client/Worker/Manager profile id. */
    receiver: string;
    title: string;
    message: string;
    /** Groups repeated pushes for the same chat into one tray entry instead of stacking. */
    chatId: string;
    data?: Record<string, unknown>;
}

/**
 * Chat messages skip sendNotification/the Notification collection entirely —
 * a busy chat would flood that generic list. This only covers the one gap
 * chat's own realtime delivery doesn't: an OS push for an offline recipient,
 * collapsed per-chat so it can't stack into a wall of alerts.
 */
const sendChatPushNotification = async ({
    receiver,
    title,
    message,
    chatId,
    data = {},
}: SendChatPushNotificationParams) => {
    const userId = receiver.toString();

    // Online: the chat's own socket event already delivered this in realtime.
    if (isUserOnline(userId)) return;

    const devices = await Device.find({
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
    }).select('playerId');

    const playerIds = devices.map((d) => d.playerId).filter(Boolean);
    if (playerIds.length === 0) return;

    await sendPushNotification({
        playerIds,
        message,
        heading: title,
        data: { chatId, ...data },
        collapseId: chatId,
    });
};

const NotificationService = {
    getAllNotificationFromDB,
    seeNotification,
    sendNotification,
    sendChatPushNotification,
    seeSingleNotification,
    deleteNotification,
};

export default NotificationService;
