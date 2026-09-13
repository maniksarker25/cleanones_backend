import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { getIO } from '../../socket/socket';
import { USER_ROLE } from '../user/user.constant';
import { ICleaningPlan } from '../cleaning_plan/cleaning_plan.interface';
import { Chat } from './chat.model';

type TMinimalPlan = Pick<
    ICleaningPlan,
    'title' | 'client' | 'assigned_workers'
> & { _id: Types.ObjectId | string };

// ─── Group chat lifecycle hooks (called from cleaning_plan.services.ts) ───────

const createChatGroupForPlan = async (plan: TMinimalPlan) => {
    const workers = (plan.assigned_workers || []).map((aw) => aw.worker);

    return Chat.create({
        type: 'group',
        cleaning_plan: plan._id,
        name: plan.title,
        client: plan.client,
        workers,
    });
};

const syncChatGroupWorkers = async (
    planId: Types.ObjectId | string,
    newWorkerIds: Array<Types.ObjectId | string>
) => {
    const group = await Chat.findOne({ cleaning_plan: planId, type: 'group' });
    if (!group) return null;

    const previousIds = group.workers.map((w) => w.toString());
    const nextIds = newWorkerIds.map((w) => w.toString());

    const added = nextIds.filter((id) => !previousIds.includes(id));
    const removed = previousIds.filter((id) => !nextIds.includes(id));

    if (added.length === 0 && removed.length === 0) return group;

    group.workers = newWorkerIds.map((id) => new Types.ObjectId(id.toString()));
    await group.save();

    try {
        const io = getIO();
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
    } catch {
        // Socket layer may not be initialized (e.g. tests) — membership sync
        // in the database is the source of truth; the realtime nudge is best-effort.
    }

    return group;
};

const deactivateChatGroupForPlan = async (planId: Types.ObjectId | string) => {
    return Chat.findOneAndUpdate(
        { cleaning_plan: planId, type: 'group' },
        { is_active: false },
        { new: true }
    );
};

// ─── Direct (1:1) chat: find-or-create ──────────────────────────────────────

const findOrCreateDirectChat = async (clientId: string, workerId: string) => {
    const participant_key = [clientId, workerId].sort().join(':');

    const chat = await Chat.findOneAndUpdate(
        { type: 'direct', participant_key },
        {
            $setOnInsert: {
                type: 'direct',
                client: clientId,
                workers: [workerId],
                participant_key,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return chat;
};

// ─── Access control (shared with chat_message services) ───────────────────────

const ensureChatAccessOrThrow = async (
    chatId: string,
    profileId: string,
    role: string
) => {
    const chat = await Chat.findById(chatId);
    if (!chat) {
        throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
    }

    // Managers get blanket access to every group chat (by design — "all
    // managers" are members of every cleaning-plan chat). Direct 1:1 chats
    // are private between a client and a worker; managers are not
    // automatically part of those.
    if (role === USER_ROLE.manager && chat.type === 'group') {
        return chat;
    }

    const isClient =
        role === USER_ROLE.client && chat.client.toString() === profileId;
    const isWorker =
        role === USER_ROLE.worker &&
        chat.workers.some((w) => w.toString() === profileId);

    if (!isClient && !isWorker) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You are not a member of this chat'
        );
    }

    return chat;
};

// ─── REST: rename (group only) ─────────────────────────────────────────────────

const renameChatIntoDB = async (
    managerId: string,
    chatId: string,
    name: string
) => {
    const chat = await Chat.findById(chatId);
    if (!chat) {
        throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
    }
    if (chat.type !== 'group') {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Only group chats can be renamed'
        );
    }

    const result = await Chat.findByIdAndUpdate(
        chatId,
        { name, last_updated_by: managerId },
        { new: true, runValidators: true }
    );

    try {
        const io = getIO();
        const payload = { _id: chatId, name };
        io.to(`group:${chatId}`).emit('group:renamed', payload);
        io.to('role:manager').emit('group:renamed', payload);
        io.to(chat.client.toString()).emit('group:renamed', payload);
        chat.workers.forEach((workerId) => {
            io.to(workerId.toString()).emit('group:renamed', payload);
        });
    } catch {
        // best-effort realtime nudge, see note above
    }

    return result;
};

// ─── REST: list my group chats ──────────────────────────────────────────────

const getMyGroupsFromDB = async (
    profileId: string,
    role: string,
    query: Record<string, unknown>
) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { is_active: true, type: 'group' };
    if (role === USER_ROLE.client) {
        filter.client = profileId;
    } else if (role === USER_ROLE.worker) {
        filter.workers = profileId;
    }
    // managers see every active group — no extra filter.

    const [result, total] = await Promise.all([
        Chat.find(filter)
            .sort({ last_message_at: -1, created_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('client', 'name email phone')
            .populate({
                path: 'last_message',
                populate: { path: 'sender', select: 'full_name profile_photo email' },
            }),
        Chat.countDocuments(filter),
    ]);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

// ─── REST: list my direct (1:1) chats ───────────────────────────────────────

const getMyDirectChatsFromDB = async (
    profileId: string,
    role: string,
    query: Record<string, unknown>
) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> =
        role === USER_ROLE.client
            ? { type: 'direct', client: profileId }
            : { type: 'direct', workers: profileId };

    const [result, total] = await Promise.all([
        Chat.find(filter)
            .sort({ last_message_at: -1, created_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('client', 'name email phone')
            .populate({
                path: 'workers',
                select: 'email phone worker_type',
                populate: { path: 'user', select: 'full_name profile_photo' },
            })
            .populate({
                path: 'last_message',
                populate: { path: 'sender', select: 'full_name profile_photo email' },
            }),
        Chat.countDocuments(filter),
    ]);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
};

// ─── REST: members ──────────────────────────────────────────────────────────

const getGroupMembersFromDB = async (
    chatId: string,
    profileId: string,
    role: string
) => {
    const chat = await ensureChatAccessOrThrow(chatId, profileId, role);

    const populated = await chat.populate([
        { path: 'client', select: 'name email phone' },
        {
            path: 'workers',
            select: 'email phone worker_type',
            populate: { path: 'user', select: 'full_name profile_photo' },
        },
    ]);

    return {
        client: (populated as unknown as { client: unknown }).client,
        workers: (populated as unknown as { workers: unknown[] }).workers,
        managers: chat.type === 'group' ? ('all' as const) : undefined,
    };
};

const chatServices = {
    createChatGroupForPlan,
    syncChatGroupWorkers,
    deactivateChatGroupForPlan,
    findOrCreateDirectChat,
    ensureChatAccessOrThrow,
    renameChatIntoDB,
    getMyGroupsFromDB,
    getMyDirectChatsFromDB,
    getGroupMembersFromDB,
};

export default chatServices;
