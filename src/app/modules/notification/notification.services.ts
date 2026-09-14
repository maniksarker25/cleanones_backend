/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
    query: Record<string, any>,
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
        // const adminUnseenNotificationCount = await getAdminNotificationCount();
        //@ts-ignore
        // global.io.emit('admin-notifications', adminUnseenNotificationCount);
    }
    if (user?.role !== USER_ROLE.superAdmin) {
        result = await Notification.updateMany(
            { receiver: user?.profileId },
            { isRead: true },
            { runValidators: true, new: true }
        );
    }
    //   const updatedNotificationCount = await getUnseenNotificationCount(
    //     user?.userId,
    //   );
    //@ts-ignore
    //   global.io.to(user?.userId).emit('notifications', updatedNotificationCount);
    return result;
};
const seeSingleNotification = async (
    notificationId: string,
    user: JwtPayload
) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }

    const filter: any = {
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

    const filter: any = {
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

    const playerIds = devices.map((d: any) => d.playerId).filter(Boolean);
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
 * Chat messages are deliberately NOT routed through sendNotification/the
 * Notification collection: a busy group chat would otherwise flood the
 * generic notification list with one row per message, drowning out actual
 * business events (plan created, task approved, etc.), and an offline
 * recipient would get one separate OS push per message instead of one
 * collapsed "new messages" alert. Chat already has its own history/unread
 * tracking (ChatMessage + the seen mechanism) and its own realtime delivery
 * (group:new-message/message:new via chat_message.services.ts) — this only
 * covers the one gap those don't: an OS-level push for someone who's
 * currently offline, collapsed per-chat via OneSignal's collapse key so it
 * can never stack into a wall of alerts.
 */
const sendChatPushNotification = async ({
    receiver,
    title,
    message,
    chatId,
    data = {},
}: SendChatPushNotificationParams) => {
    const userId = receiver.toString();

    // Online: the chat's own socket event (group:new-message/message:new)
    // already delivered this in realtime — nothing further to do here.
    if (isUserOnline(userId)) return;

    const devices = await Device.find({
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
    }).select('playerId');

    const playerIds = devices.map((d: any) => d.playerId).filter(Boolean);
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
