import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import chatServices from '../chat/chat.services';
import { Shift } from '../shift/shift.model';
import { PROFILE_MODEL_BY_ROLE, USER_ROLE } from '../user/user.constant';
import { User } from '../user/user.model';
import { Worker } from './worker.model';
import { TWorker } from './worker.interface';
import { WorkerType } from './worker.constant';
import workerValidations, {
    CreateWorkerInput,
    UpdateWorkerInput,
} from './worker.validation';

// Also include profiles created before the soft-delete field was introduced.
const activeWorker = { isDeleted: { $ne: true } };

const validateId = (id: string) => {
    if (!mongoose.isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }
};

const createWorkerIntoDB = async (payload: CreateWorkerInput) => {
    // Credentials are stored only on the linked user account.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const { password, confirmPassword, ...workerData } =
        workerValidations.createWorkerBody.parse(payload);
    if (
        workerData.working_days !== undefined &&
        workerData.worker_type !== WorkerType.Employee
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'Only the manager can set working days for employees. Freelancers manage their own availability'
        );
    }
    const session = await mongoose.startSession();
    let worker;
    try {
        worker = await session.withTransaction(async () => {
            const existing = await User.findOne({
                isDeleted: { $ne: true },
                $or: [{ email: workerData.email }, { phone: workerData.phone }],
            }).session(session);
            if (existing) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    'Email or phone already exists'
                );
            }
            const [user] = await User.create(
                [
                    {
                        email: workerData.email,
                        phone: workerData.phone,
                        password,
                        role: USER_ROLE.worker,
                        roles: [USER_ROLE.worker],
                        profileModel: PROFILE_MODEL_BY_ROLE.worker,
                        isVerified: true,
                        is_admin_created: true,
                    },
                ],
                { session }
            );
            const [createdWorker] = await Worker.create(
                [
                    {
                        ...workerData,
                        user: user._id,
                    },
                ],
                { session }
            );
            await User.findByIdAndUpdate(
                user._id,
                { profileId: createdWorker._id },
                { session }
            );
            return createdWorker;
        });
    } finally {
        await session.endSession();
    }

    // Best-effort, outside the transaction — same pattern as
    // createChatGroupForPlan for cleaning plans. Idempotent (unique index on
    // the chat side), so a retry here can never create a duplicate.
    await chatServices.createWorkerManagersChat(worker._id);

    return worker;
};

const updateWorkerIntoDB = async (id: string, payload: UpdateWorkerInput) => {
    validateId(id);
    const data = workerValidations.updateWorkerBody.parse(payload);
    const session = await mongoose.startSession();
    try {
        return await session.withTransaction(async () => {
            const worker = await Worker.findOne({
                _id: id,
                ...activeWorker,
            }).session(session);
            if (!worker)
                throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
            // Manager can only set working_days for Employee-type workers.
            // Freelancers manage their own availability via /my-availability.
            if (
                data.working_days !== undefined &&
                worker.worker_type !== WorkerType.Employee
            ) {
                throw new AppError(
                    httpStatus.FORBIDDEN,
                    'Managers can only set working days for employees. Freelancers manage their own availability'
                );
            }
            const contactFilters = [];
            if (data.email !== undefined)
                contactFilters.push({ email: data.email });
            if (data.phone !== undefined)
                contactFilters.push({ phone: data.phone });
            if (contactFilters.length) {
                const existing = await User.findOne({
                    _id: { $ne: worker.user },
                    isDeleted: { $ne: true },
                    $or: contactFilters,
                }).session(session);
                if (existing) {
                    throw new AppError(
                        httpStatus.BAD_REQUEST,
                        'Email or phone already exists'
                    );
                }
                const user = await User.findByIdAndUpdate(
                    worker.user,
                    {
                        $set: {
                            ...(data.email !== undefined && {
                                email: data.email,
                            }),
                            ...(data.phone !== undefined && {
                                phone: data.phone,
                            }),
                        },
                    },
                    { session, runValidators: true }
                );
                if (!user)
                    throw new AppError(
                        httpStatus.NOT_FOUND,
                        'Worker account not found'
                    );
            }
            return Worker.findOneAndUpdate(
                { _id: id, ...activeWorker },
                { $set: data },
                { new: true, runValidators: true, session }
            );
        });
    } finally {
        await session.endSession();
    }
};

const deleteWorkerFromDB = async (id: string) => {
    validateId(id);
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const worker = await Worker.findOneAndUpdate(
                { _id: id, ...activeWorker },
                { $set: { isDeleted: true } },
                { new: true, session }
            );
            if (!worker)
                throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
            await User.findByIdAndUpdate(
                worker.user,
                {
                    $set: { isDeleted: true, isBlocked: true },
                },
                { session }
            );
        });
    } finally {
        await session.endSession();
    }

    await chatServices.deactivateWorkerManagersChat(id);

    return null;
};

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

// All-time sum of (check_out_at - check_in_at) across every completed
// check-in, per worker, in hours — mirrors the same calculation used by
// shift.services.ts's attendance/performance endpoints, just without a date
// range since this is a lifetime total for the worker list.
const getTotalCompletedWorkHoursByWorker = async (
    workerIds: mongoose.Types.ObjectId[]
) => {
    const hoursByWorker = new Map<string, number>();
    if (!workerIds.length) return hoursByWorker;

    const shifts = await Shift.find({
        'assigned_workers.worker': { $in: workerIds },
    })
        .select('assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
        .lean();

    const idSet = new Set(workerIds.map((id) => id.toString()));
    const msByWorker = new Map<string, number>();
    for (const shift of shifts) {
        for (const entry of shift.assigned_workers) {
            const workerId = entry.worker.toString();
            if (!idSet.has(workerId)) continue;
            if (entry.check_in_at && entry.check_out_at) {
                msByWorker.set(
                    workerId,
                    (msByWorker.get(workerId) ?? 0) +
                        (entry.check_out_at.getTime() - entry.check_in_at.getTime())
                );
            }
        }
    }

    for (const [workerId, ms] of msByWorker) {
        hoursByWorker.set(workerId, roundToTwoDecimals(ms / 3_600_000));
    }
    return hoursByWorker;
};

interface WorkerShiftStats {
    total_completed_work_hours: number;
    total_shift: number;
    total_late_check_ins: number;
    total_on_time_check_ins: number;
    total_absent: number;
}

/**
 * All-time shift stats for a batch of workers, in ONE query total — not one
 * per worker — so a 100-row page (the list's max limit) costs the same
 * single round trip as a 1-row page. Mirrors
 * getTotalCompletedWorkHoursByWorker/getWorkerAttendanceStatsFromDB's
 * definitions but computes every field in a single pass over the same
 * shift/assigned_workers data instead of running separate queries for hours
 * vs. late/on-time/absent:
 * - total_shift: shifts (excluding cancelled) this worker was ever assigned to.
 * - total_late_check_ins / total_on_time_check_ins: of the shifts they
 *   actually checked into, whether check_in_at was after/at-or-before the
 *   shift's scheduled date_time. Mutually exclusive with each other.
 * - total_absent: past shifts (date before today) they were assigned to but
 *   never checked into at all — mutually exclusive with the two above (a
 *   worker who checked in, even late, was not absent).
 * - total_completed_work_hours: sum of (check_out_at - check_in_at) across
 *   every completed check-in, in hours.
 */
const getWorkerShiftStatsByWorker = async (
    workerIds: mongoose.Types.ObjectId[]
): Promise<Map<string, WorkerShiftStats>> => {
    const statsByWorker = new Map<string, WorkerShiftStats>();
    if (!workerIds.length) return statsByWorker;

    const idSet = new Set(workerIds.map((id) => id.toString()));
    const today = new Date(
        Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
        )
    );

    const shifts = await Shift.find({
        'assigned_workers.worker': { $in: workerIds },
        status: { $ne: 'cancelled' },
    })
        .select(
            'date date_time assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at'
        )
        .lean();

    const msByWorker = new Map<string, number>();
    for (const shift of shifts) {
        for (const aw of shift.assigned_workers) {
            const workerId = aw.worker.toString();
            if (!idSet.has(workerId)) continue;

            const stats =
                statsByWorker.get(workerId) ??
                ({
                    total_completed_work_hours: 0,
                    total_shift: 0,
                    total_late_check_ins: 0,
                    total_on_time_check_ins: 0,
                    total_absent: 0,
                } satisfies WorkerShiftStats);
            statsByWorker.set(workerId, stats);

            stats.total_shift += 1;

            if (aw.check_in_at && aw.check_out_at) {
                msByWorker.set(
                    workerId,
                    (msByWorker.get(workerId) ?? 0) +
                        (aw.check_out_at.getTime() - aw.check_in_at.getTime())
                );
            }

            if (aw.check_in_at) {
                if (aw.check_in_at > shift.date_time) {
                    stats.total_late_check_ins += 1;
                } else {
                    stats.total_on_time_check_ins += 1;
                }
            } else if (shift.date < today) {
                stats.total_absent += 1;
            }
        }
    }

    for (const [workerId, ms] of msByWorker) {
        const stats = statsByWorker.get(workerId);
        if (stats) stats.total_completed_work_hours = roundToTwoDecimals(ms / 3_600_000);
    }

    return statsByWorker;
};

const EMPTY_WORKER_SHIFT_STATS: WorkerShiftStats = {
    total_completed_work_hours: 0,
    total_shift: 0,
    total_late_check_ins: 0,
    total_on_time_check_ins: 0,
    total_absent: 0,
};

const getAllWorkersFromDB = async (query: Record<string, unknown>) => {
    const parsed = workerValidations.workerListQuery.parse(query);
    const safeQuery = {
        ...parsed,
        ...(parsed.searchTerm && {
            searchTerm: parsed.searchTerm.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            ),
        }),
    };
    const workerQuery = new QueryBuilder(Worker.find(activeWorker), safeQuery)
        .search(['name', 'email', 'phone', 'position', 'nationality'])
        .filter()
        .paginate()
        .sort();
    const meta = await workerQuery.countTotal();
    const workers = (await workerQuery.modelQuery) as unknown as Array<
        TWorker & {
            _id: mongoose.Types.ObjectId;
            toObject: () => Record<string, unknown>;
        }
    >;

    const statsByWorker = await getWorkerShiftStatsByWorker(
        workers.map((worker) => worker._id)
    );
    const result = workers.map((worker) => ({
        ...worker.toObject(),
        ...(statsByWorker.get(worker._id.toString()) ?? EMPTY_WORKER_SHIFT_STATS),
    }));

    return { meta, result };
};

// All-time attendance stats for one worker, across every materialized shift
// they've ever been assigned to. Mirrors the late/absent definitions used by
// getWorkerPerformanceFromDB (shift.services.ts), just without the month
// filter — late: worker's own check_in_at is after the shift's scheduled
// date_time; absent: the shift's date is in the past, status isn't
// 'cancelled', and the worker never checked in.
const getWorkerAttendanceStatsFromDB = async (workerId: mongoose.Types.ObjectId) => {
    const today = new Date(
        Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
        )
    );

    const shifts = await Shift.find({ 'assigned_workers.worker': workerId })
        .select('date date_time status assigned_workers.worker assigned_workers.check_in_at')
        .lean();

    let completed = 0;
    let inProgress = 0;
    let late = 0;
    let absent = 0;

    for (const shift of shifts) {
        if (shift.status === 'completed') completed += 1;
        if (shift.status === 'in_progress') inProgress += 1;

        const entry = shift.assigned_workers.find(
            (aw) => aw.worker.toString() === workerId.toString()
        );
        if (!entry) continue;

        if (entry.check_in_at && entry.check_in_at > shift.date_time) {
            late += 1;
        }
        if (shift.date < today && shift.status !== 'cancelled' && !entry.check_in_at) {
            absent += 1;
        }
    }

    return {
        total_completed_shift: completed,
        total_in_progress_shift: inProgress,
        total_late_count: late,
        total_absent: absent,
    };
};

const getSingleWorkerFromDB = async (id: string) => {
    validateId(id);
    const worker = await Worker.findOne({ _id: id, ...activeWorker });
    if (!worker) throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');

    const [totalHours, attendanceStats] = await Promise.all([
        getTotalCompletedWorkHoursByWorker([worker._id]),
        getWorkerAttendanceStatsFromDB(worker._id),
    ]);

    return {
        ...worker.toObject(),
        total_completed_work_hours: totalHours.get(worker._id.toString()) ?? 0,
        ...attendanceStats,
    };
};

const updateMyAvailabilityIntoDB = async (
    userId: string,
    payload: { working_days: string[] }
) => {
    const data = workerValidations.availabilityBody.parse(payload);
    const worker = await Worker.findOneAndUpdate(
        { user: userId, worker_type: WorkerType.Freelancer, ...activeWorker },
        { $set: { working_days: data.working_days } },
        { new: true, runValidators: true }
    );
    if (!worker) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'Only active freelancers can update their own availability'
        );
    }
    return worker;
};

export default {
    updateMyAvailabilityIntoDB,
    createWorkerIntoDB,
    updateWorkerIntoDB,
    deleteWorkerFromDB,
    getAllWorkersFromDB,
    getSingleWorkerFromDB,
};
