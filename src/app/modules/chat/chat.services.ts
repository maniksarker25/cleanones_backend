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

// ─── Worker<->managers chat lifecycle hooks (called from worker.services.ts) ──

// One per worker, created right after the worker profile — that worker plus
// every manager (implicitly, the same way a manager is implicitly in every
// 'group' chat — see ensureChatAccessOrThrow). Idempotent via the unique
// partial index on { workers: 1 } for type: 'worker', so calling this twice
// for the same worker is a harmless no-op rather than a duplicate chat.
const createWorkerManagersChat = async (workerId: Types.ObjectId | string) => {
    const chat = await Chat.findOneAndUpdate(
        { type: 'worker', workers: workerId },
        { $setOnInsert: { type: 'worker', workers: [workerId] } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
        const io = getIO();
        io.to('role:manager').emit('worker-chat:created', {
            _id: chat._id,
            worker: workerId,
        });
    } catch {
        // best-effort realtime nudge, see note above createChatGroupForPlan
    }

    return chat;
};

const deactivateWorkerManagersChat = async (
    workerId: Types.ObjectId | string
) => {
    return Chat.findOneAndUpdate(
        { type: 'worker', workers: workerId },
        { is_active: false },
        { new: true }
    );
};

// ─── Client<->managers chat lifecycle hooks (called from client.services.ts) ──
//
// Exact mirror of the worker<->managers chat above, other than which side is
// singular: one per client, that client plus every manager implicitly a
// member, no workers involved.

const createClientManagersChat = async (clientId: Types.ObjectId | string) => {
    const chat = await Chat.findOneAndUpdate(
        { type: 'client', client: clientId },
        { $setOnInsert: { type: 'client', client: clientId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
        const io = getIO();
        io.to('role:manager').emit('client-chat:created', {
            _id: chat._id,
            client: clientId,
        });
    } catch {
        // best-effort realtime nudge, see note above createChatGroupForPlan
    }

    return chat;
};

const deactivateClientManagersChat = async (
    clientId: Types.ObjectId | string
) => {
    return Chat.findOneAndUpdate(
        { type: 'client', client: clientId },
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

    // Managers get blanket access to every group, worker<->managers, and
    // client<->managers chat (by design — "all managers" are implicitly
    // members of all three). Direct 1:1 chats are private between a client
    // and a worker; managers are not automatically part of those.
    if (
        role === USER_ROLE.manager &&
        (chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client')
    ) {
        return chat;
    }

    const isClient =
        role === USER_ROLE.client &&
        !!chat.client &&
        chat.client.toString() === profileId;
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
        if (chat.client) {
            io.to(chat.client.toString()).emit('group:renamed', payload);
        }
        chat.workers.forEach((workerId) => {
            io.to(workerId.toString()).emit('group:renamed', payload);
        });
    } catch {
        // best-effort realtime nudge, see note above
    }

    return result;
};

// Neither a 'worker' nor a 'client' chat has a single stored name — each is
// named from the other party's point of view: "Managers"/"Manager" for the
// worker/client themselves, and the other party's own name for a manager.
// Computed here rather than stored, so it can never go stale and there is
// nothing to keep in sync when a worker or client renames themselves.
const WORKER_CHAT_NAME_FOR_WORKER = 'Managers';
const CLIENT_CHAT_NAME_FOR_CLIENT = 'Manager';

const toDisplayName = (
    chat: {
        type: string;
        name?: string | null;
        client?: unknown;
        workers: unknown[];
    },
    role: string
): string | null => {
    if (chat.type === 'worker') {
        if (role === USER_ROLE.worker) return WORKER_CHAT_NAME_FOR_WORKER;
        const worker = chat.workers[0] as { name?: string } | undefined;
        return worker?.name ?? null;
    }
    if (chat.type === 'client') {
        if (role === USER_ROLE.client) return CLIENT_CHAT_NAME_FOR_CLIENT;
        const client = chat.client as { name?: string } | undefined;
        return client?.name ?? null;
    }
    return chat.name ?? null;
};

// ─── REST: unified chat list (all four types, one query, one sort) ─────────
//
// Chat already stores all four types in one collection with shared
// client/workers fields, so a single filter naturally covers whichever types
// apply to the caller without a separate query per type or an app-level
// merge: a client's chats are simply every active Chat with client = them
// (group, direct, or their one client-chat — all three share that field); a
// worker's are every active Chat with them in workers (group, direct, or
// their one worker-chat). A manager's are every active group, worker-chat and
// client-chat — never direct chats, which are private between a client and a
// worker and managers are deliberately not implicit members of those (see
// ensureChatAccessOrThrow).

const getMyChatsFromDB = async (
    profileId: string,
    role: string,
    query: Record<string, unknown>
) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    let filter: Record<string, unknown>;
    if (role === USER_ROLE.manager) {
        filter = {
            is_active: true,
            type: { $in: ['group', 'worker', 'client'] },
        };
    } else if (role === USER_ROLE.client) {
        filter = { is_active: true, client: profileId };
    } else {
        filter = { is_active: true, workers: profileId };
    }

    const [chats, total] = await Promise.all([
        Chat.find(filter)
            .sort({ last_message_at: -1, created_at: -1 })
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
        Chat.countDocuments(filter),
    ]);

    const result = chats.map((chat) => ({
        ...chat,
        display_name: toDisplayName(chat, role),
    }));

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
            select: 'name email phone worker_type',
            populate: { path: 'user', select: 'full_name profile_photo' },
        },
    ]);

    return {
        client: (populated as unknown as { client: unknown }).client,
        workers: (populated as unknown as { workers: unknown[] }).workers,
        managers:
            chat.type === 'group' ||
            chat.type === 'worker' ||
            chat.type === 'client'
                ? ('all' as const)
                : undefined,
        display_name: toDisplayName(
            populated as unknown as {
                type: string;
                name?: string | null;
                client?: unknown;
                workers: unknown[];
            },
            role
        ),
    };
};

const chatServices = {
    createChatGroupForPlan,
    syncChatGroupWorkers,
    deactivateChatGroupForPlan,
    createWorkerManagersChat,
    deactivateWorkerManagersChat,
    createClientManagersChat,
    deactivateClientManagersChat,
    findOrCreateDirectChat,
    ensureChatAccessOrThrow,
    renameChatIntoDB,
    getMyChatsFromDB,
    getGroupMembersFromDB,
};

export default chatServices;
