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
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const socket_1 = require("../../socket/socket");
const user_constant_1 = require("../user/user.constant");
const chat_model_1 = require("./chat.model");
const createChatGroupForPlan = (plan) => __awaiter(void 0, void 0, void 0, function* () {
    return chat_model_1.Chat.create({
        type: 'group',
        cleaning_plan: plan._id,
        name: plan.title,
        client: plan.client,
        workers: [],
    });
});
const getChatGroupWorkerIds = (planId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const group = yield chat_model_1.Chat.findOne({ cleaning_plan: planId, type: 'group' })
        .select('workers')
        .lean();
    return ((_a = group === null || group === void 0 ? void 0 : group.workers) !== null && _a !== void 0 ? _a : []).map((w) => w.toString());
});
const syncChatGroupWorkers = (planId, newWorkerIds) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield chat_model_1.Chat.findOne({ cleaning_plan: planId, type: 'group' });
    if (!group)
        return null;
    const previousIds = group.workers.map((w) => w.toString());
    const nextIds = newWorkerIds.map((w) => w.toString());
    const added = nextIds.filter((id) => !previousIds.includes(id));
    const removed = previousIds.filter((id) => !nextIds.includes(id));
    if (added.length === 0 && removed.length === 0)
        return group;
    group.workers = newWorkerIds.map((id) => new mongoose_1.Types.ObjectId(id.toString()));
    yield group.save();
    try {
        const io = (0, socket_1.getIO)();
        const groupSummary = {
            _id: group._id,
            name: group.name,
            cleaning_plan: group.cleaning_plan,
        };
        added.forEach((workerId) => {
            io.to(workerId).emit('group:added', groupSummary);
        });
        removed.forEach((workerId) => {
            io.to(workerId).emit('group:removed', {
                _id: group._id,
                cleaning_plan: group.cleaning_plan,
            });
        });
    }
    catch (_b) {
        // Socket layer may not be initialized (e.g. tests) — membership sync
        // in the database is the source of truth; the realtime nudge is best-effort.
    }
    return group;
});
const deactivateChatGroupForPlan = (planId, session) => __awaiter(void 0, void 0, void 0, function* () {
    return chat_model_1.Chat.findOneAndUpdate({ cleaning_plan: planId, type: 'group' }, { is_active: false }, { new: true, session });
});
const deactivateChatGroupsForPlans = (planIds, session) => __awaiter(void 0, void 0, void 0, function* () {
    if (!planIds.length)
        return;
    yield chat_model_1.Chat.updateMany({ cleaning_plan: { $in: planIds }, type: 'group' }, { is_active: false }, { session });
});
const createWorkerManagersChat = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield chat_model_1.Chat.findOneAndUpdate({ type: 'worker', workers: workerId }, { $setOnInsert: { type: 'worker', workers: [workerId] } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    try {
        const io = (0, socket_1.getIO)();
        io.to('role:manager').emit('worker-chat:created', {
            _id: chat._id,
            worker: workerId,
        });
    }
    catch (_c) {
    }
    return chat;
});
const deactivateWorkerManagersChat = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    return chat_model_1.Chat.findOneAndUpdate({ type: 'worker', workers: workerId }, { is_active: false }, { new: true });
});
const createClientManagersChat = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield chat_model_1.Chat.findOneAndUpdate({ type: 'client', client: clientId }, { $setOnInsert: { type: 'client', client: clientId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    try {
        const io = (0, socket_1.getIO)();
        io.to('role:manager').emit('client-chat:created', {
            _id: chat._id,
            client: clientId,
        });
    }
    catch (_d) {
        // best-effort realtime nudge, see note above createChatGroupForPlan
    }
    return chat;
});
const deactivateClientManagersChat = (clientId, session) => __awaiter(void 0, void 0, void 0, function* () {
    return chat_model_1.Chat.findOneAndUpdate({ type: 'client', client: clientId }, { is_active: false }, { new: true, session });
});
// ─── Direct (1:1) chat: find-or-create ──────────────────────────────────────
const findOrCreateDirectChat = (clientId, workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const participant_key = [clientId, workerId].sort().join(':');
    const chat = yield chat_model_1.Chat.findOneAndUpdate({ type: 'direct', participant_key }, {
        $setOnInsert: {
            type: 'direct',
            client: clientId,
            workers: [workerId],
            participant_key,
        },
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
    return chat;
});
// ─── Access control (shared with chat_message services) ───────────────────────
const ensureChatAccessOrThrow = (chatId, profileId, role) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Chat not found');
    }
    if (role === user_constant_1.USER_ROLE.manager &&
        (chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client')) {
        return chat;
    }
    const isClient = role === user_constant_1.USER_ROLE.client &&
        !!chat.client &&
        chat.client.toString() === profileId;
    const isWorker = role === user_constant_1.USER_ROLE.worker &&
        chat.workers.some((w) => w.toString() === profileId);
    if (!isClient && !isWorker) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not a member of this chat');
    }
    return chat;
});
// ─── REST: rename (group only) ─────────────────────────────────────────────────
const renameChatIntoDB = (managerId, chatId, name) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Chat not found');
    }
    if (chat.type !== 'group') {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Only group chats can be renamed');
    }
    const result = yield chat_model_1.Chat.findByIdAndUpdate(chatId, { name, last_updated_by: managerId }, { new: true, runValidators: true });
    try {
        const io = (0, socket_1.getIO)();
        const payload = { _id: chatId, name };
        io.to(`group:${chatId}`).emit('group:renamed', payload);
        io.to('role:manager').emit('group:renamed', payload);
        if (chat.client) {
            io.to(chat.client.toString()).emit('group:renamed', payload);
        }
        chat.workers.forEach((workerId) => {
            io.to(workerId.toString()).emit('group:renamed', payload);
        });
    }
    catch (_e) {
        // best-effort realtime nudge, see note above
    }
    return result;
});
// ─── REST: remove a worker from a group (manager only) ─────────────────────────
const removeGroupMemberFromDB = (managerId, chatId, workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Chat not found');
    }
    if (chat.type !== 'group') {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Only group chats support removing a member');
    }
    const wasMember = chat.workers.some((w) => w.toString() === workerId);
    if (!wasMember) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Worker is not a member of this chat group');
    }
    const result = yield chat_model_1.Chat.findByIdAndUpdate(chatId, { $pull: { workers: workerId }, last_updated_by: managerId }, { new: true, runValidators: true });
    try {
        const io = (0, socket_1.getIO)();
        const groupSummary = { _id: chatId, cleaning_plan: chat.cleaning_plan };
        // The removed worker: same shape/event syncChatGroupWorkers already
        // uses when a shift reassignment drops them, so the client only
        // needs one handler for "I lost access to this group" either way.
        io.to(workerId).emit('group:removed', groupSummary);
        // Everyone still in the group: member-list refresh, not a full
        // group:removed (they haven't lost access, just the roster changed).
        const memberChangedPayload = { _id: chatId, worker: workerId };
        io.to(`group:${chatId}`).emit('group:member-removed', memberChangedPayload);
        io.to('role:manager').emit('group:member-removed', memberChangedPayload);
        if (chat.client) {
            io.to(chat.client.toString()).emit('group:member-removed', memberChangedPayload);
        }
        chat.workers.forEach((remainingWorkerId) => {
            if (remainingWorkerId.toString() === workerId)
                return;
            io.to(remainingWorkerId.toString()).emit('group:member-removed', memberChangedPayload);
        });
    }
    catch (_f) {
        // best-effort realtime nudge, see note above createChatGroupForPlan
    }
    return result;
});
const WORKER_CHAT_NAME_FOR_WORKER = 'Managers';
const CLIENT_CHAT_NAME_FOR_CLIENT = 'Manager';
const toDisplayName = (chat, role) => {
    var _a, _b, _c;
    if (chat.type === 'worker') {
        if (role === user_constant_1.USER_ROLE.worker)
            return WORKER_CHAT_NAME_FOR_WORKER;
        const worker = chat.workers[0];
        return (_a = worker === null || worker === void 0 ? void 0 : worker.name) !== null && _a !== void 0 ? _a : null;
    }
    if (chat.type === 'client') {
        if (role === user_constant_1.USER_ROLE.client)
            return CLIENT_CHAT_NAME_FOR_CLIENT;
        const client = chat.client;
        return (_b = client === null || client === void 0 ? void 0 : client.name) !== null && _b !== void 0 ? _b : null;
    }
    return (_c = chat.name) !== null && _c !== void 0 ? _c : null;
};
const getMyChatsFromDB = (profileId, role, query) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    let filter;
    if (role === user_constant_1.USER_ROLE.manager) {
        filter = {
            is_active: true,
            type: { $in: ['group', 'worker', 'client'] },
        };
    }
    else if (role === user_constant_1.USER_ROLE.client) {
        filter = { is_active: true, client: profileId };
    }
    else {
        filter = { is_active: true, workers: profileId };
    }
    const [chats, total] = yield Promise.all([
        chat_model_1.Chat.find(filter)
            .sort({ last_message_at: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('client', 'name email phone')
            .populate({
            path: 'workers',
            select: 'name email phone worker_type',
            populate: { path: 'user', select: 'full_name profile_photo' },
        })
            .populate({
            path: 'last_message',
            populate: { path: 'sender', select: 'full_name profile_photo email' },
        })
            .lean(),
        chat_model_1.Chat.countDocuments(filter),
    ]);
    const result = chats.map((chat) => (Object.assign(Object.assign({}, chat), { display_name: toDisplayName(chat, role) })));
    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
});
// ─── REST: members ──────────────────────────────────────────────────────────
const getGroupMembersFromDB = (chatId, profileId, role) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = yield ensureChatAccessOrThrow(chatId, profileId, role);
    const populated = yield chat.populate([
        { path: 'client', select: 'name email phone' },
        {
            path: 'workers',
            select: 'name email phone worker_type',
            populate: { path: 'user', select: 'full_name profile_photo' },
        },
    ]);
    return {
        client: populated.client,
        workers: populated.workers,
        managers: chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client'
            ? 'all'
            : undefined,
        display_name: toDisplayName(populated, role),
    };
});
const chatServices = {
    createChatGroupForPlan,
    getChatGroupWorkerIds,
    syncChatGroupWorkers,
    deactivateChatGroupForPlan,
    deactivateChatGroupsForPlans,
    createWorkerManagersChat,
    deactivateWorkerManagersChat,
    createClientManagersChat,
    deactivateClientManagersChat,
    findOrCreateDirectChat,
    ensureChatAccessOrThrow,
    renameChatIntoDB,
    removeGroupMemberFromDB,
    getMyChatsFromDB,
    getGroupMembersFromDB,
};
exports.default = chatServices;
