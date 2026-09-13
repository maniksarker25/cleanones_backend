import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { User } from '../user/user.model';
import { Worker } from '../worker/worker.model';

export const activeWorkerFilter = { isDeleted: { $ne: true } };

const activeUserIdSetFor = async (
    userIds: (Types.ObjectId | string)[]
): Promise<Set<string>> => {
    const activeUsers = await User.find({
        _id: { $in: userIds },
        isDeleted: { $ne: true },
        isBlocked: { $ne: true },
        isActive: true,
    })
        .select('_id')
        .lean();
    return new Set(activeUsers.map((u) => u._id.toString()));
};

/**
 * Hard eligibility check: not deleted (Worker profile) and the linked User
 * account is not deleted/blocked/inactive. This is never overridable by
 * `force` — it's a data-integrity fact, not a schedulable judgment call.
 * Throws 400 naming exactly which worker IDs failed and why.
 */
export const assertWorkersEligible = async (
    workerIds: (Types.ObjectId | string)[]
): Promise<{ _id: Types.ObjectId; user: Types.ObjectId }[]> => {
    const workers = await Worker.find({
        _id: { $in: workerIds },
        ...activeWorkerFilter,
    })
        .select('_id user')
        .lean();

    const foundIds = new Set(workers.map((w) => w._id.toString()));
    const missing = workerIds.filter((id) => !foundIds.has(id.toString()));
    if (missing.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Worker(s) not found or deleted: ${missing.join(', ')}`
        );
    }

    const activeUserIds = await activeUserIdSetFor(workers.map((w) => w.user));
    const inactiveWorkers = workers.filter(
        (w) => !activeUserIds.has(w.user.toString())
    );
    if (inactiveWorkers.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Worker(s) account is blocked/inactive: ${inactiveWorkers
                .map((w) => w._id)
                .join(', ')}`
        );
    }

    return workers;
};

/** Filters a list of Worker documents down to those with an active linked User. */
export const filterEligibleWorkers = async <
    T extends { user: Types.ObjectId }
>(
    workers: T[]
): Promise<T[]> => {
    const activeUserIds = await activeUserIdSetFor(workers.map((w) => w.user));
    return workers.filter((w) => activeUserIds.has(w.user.toString()));
};
