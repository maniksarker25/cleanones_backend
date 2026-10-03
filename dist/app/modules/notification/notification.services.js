"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const socket_1 = require("../../socket/socket");
const user_constant_1 = require("../user/user.constant");
const notification_model_1 = __importDefault(require("./notification.model"));
const mongoose_1 = __importDefault(require("mongoose"));
const device_model_1 = require("../device/device.model");
const sendPushNotification_1 = __importDefault(require("./helpers/sendPushNotification"));
const notification_enum_1 = require("./notification.enum");
const getAllNotificationFromDB = (query, user) => __awaiter(void 0, void 0, void 0, function* () {
    const receiver = (user === null || user === void 0 ? void 0 : user.role) === user_constant_1.USER_ROLE.superAdmin ? 'admin' : user === null || user === void 0 ? void 0 : user.profileId;
    const notificationQuery = new QueryBuilder_1.default(notification_model_1.default.find({ receiver }), query)
        .search(['title'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield notificationQuery.modelQuery;
    const meta = yield notificationQuery.countTotal();
    const unreadCount = yield notification_model_1.default.countDocuments({
        receiver,
        isRead: false,
    });
    return {
        meta: Object.assign(Object.assign({}, meta), { unreadCount }),
        result,
    };
});
const seeNotification = (user) => __awaiter(void 0, void 0, void 0, function* () {
    let result;
    if ((user === null || user === void 0 ? void 0 : user.role) === user_constant_1.USER_ROLE.superAdmin) {
        result = yield notification_model_1.default.updateMany({ receiver: 'admin' }, { isRead: true }, { runValidators: true, new: true });
        // const adminUnseenNotificationCount = await getAdminNotificationCount();
        //@ts-ignore
        // global.io.emit('admin-notifications', adminUnseenNotificationCount);
    }
    if ((user === null || user === void 0 ? void 0 : user.role) !== user_constant_1.USER_ROLE.superAdmin) {
        result = yield notification_model_1.default.updateMany({ receiver: user === null || user === void 0 ? void 0 : user.profileId }, { isRead: true }, { runValidators: true, new: true });
    }
    //   const updatedNotificationCount = await getUnseenNotificationCount(
    //     user?.userId,
    //   );
    //@ts-ignore
    //   global.io.to(user?.userId).emit('notifications', updatedNotificationCount);
    return result;
});
const seeSingleNotification = (notificationId, user) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }
    const filter = {
        _id: new mongoose_1.default.Types.ObjectId(notificationId),
    };
    // Security: ensure user can only update their own notification
    if ((user === null || user === void 0 ? void 0 : user.role) === user_constant_1.USER_ROLE.superAdmin) {
        filter.receiver = user_constant_1.USER_ROLE.superAdmin;
    }
    else {
        filter.receiver = user === null || user === void 0 ? void 0 : user.profileId;
    }
    const result = yield notification_model_1.default.findOneAndUpdate(filter, { isRead: true }, { new: true, runValidators: true });
    return result;
});
const deleteNotification = (notificationId, user) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }
    const filter = {
        _id: new mongoose_1.default.Types.ObjectId(notificationId),
    };
    if ((user === null || user === void 0 ? void 0 : user.role) === user_constant_1.USER_ROLE.superAdmin) {
        filter.receiver = 'admin';
    }
    else {
        filter.receiver = user === null || user === void 0 ? void 0 : user.profileId;
    }
    const result = yield notification_model_1.default.findOneAndDelete(Object.assign({}, filter));
    return result;
});
const sendNotification = ({ receiver, title, message, type, entity, action = notification_enum_1.NOTIFICATION_ACTION.VIEW, entityId, meta = {}, }) => __awaiter(void 0, void 0, void 0, function* () {
    const notification = yield notification_model_1.default.create({
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
        if ((0, socket_1.isUserOnline)(userId)) {
            (0, socket_1.getIO)().to(userId).emit('notification', notification);
            return notification;
        }
    }
    catch (error) {
        console.error('Realtime notification delivery failed:', error);
    }
    // Offline push via OneSignal, using whatever devices this receiver has
    // registered (see device.service.ts's upsertDevice).
    const devices = yield device_model_1.Device.find({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        isActive: true,
    }).select('playerId');
    const playerIds = devices.map((d) => d.playerId).filter(Boolean);
    if (playerIds.length > 0) {
        yield (0, sendPushNotification_1.default)({
            playerIds,
            message,
            heading: title,
            data: Object.assign({ entity,
                action,
                entityId }, meta),
        });
    }
    return notification;
});
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
const sendChatPushNotification = ({ receiver, title, message, chatId, data = {}, }) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = receiver.toString();
    // Online: the chat's own socket event (group:new-message/message:new)
    // already delivered this in realtime — nothing further to do here.
    if ((0, socket_1.isUserOnline)(userId))
        return;
    const devices = yield device_model_1.Device.find({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        isActive: true,
    }).select('playerId');
    const playerIds = devices.map((d) => d.playerId).filter(Boolean);
    if (playerIds.length === 0)
        return;
    yield (0, sendPushNotification_1.default)({
        playerIds,
        message,
        heading: title,
        data: Object.assign({ chatId }, data),
        collapseId: chatId,
    });
});
const NotificationService = {
    getAllNotificationFromDB,
    seeNotification,
    sendNotification,
    sendChatPushNotification,
    seeSingleNotification,
    deleteNotification,
};
exports.default = NotificationService;
