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

    // Best-effort, outside the transaction — idempotent, so a retry can't duplicate it.
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
            // Earnings already accrued are priced at the old rate; changing it while
            // money is still owed would make that balance ambiguous. Re-sending the
            // current rate is not a change, so it is allowed.

            console.log("pending amount", worker.pending_amount, "hourly rate", data.hourly_rate, "worker hourly rate", worker.hourly_rate)
            if (
                data.hourly_rate !== undefined &&
                data.hourly_rate !== worker.hourly_rate &&
                worker.pending_amount >= 1
            ) {
                throw new AppError(
                    httpStatus.CONFLICT,
                    `Hourly rate can't be changed while ${roundToTwoDecimals(worker.pending_amount)} is still pending. Pay the pending amount first.`,
                    '',
                    {
                        pending_amount: worker.pending_amount,
                        current_hourly_rate: worker.hourly_rate,
                    }
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

    // Past (completed/cancelled) shifts are history and don't block deletion;
    // anything still upcoming or in progress must be reassigned first.
    const activeShifts = await Shift.find({
        'assigned_workers.worker': id,
        status: { $in: ['upcoming', 'in_progress'] },
    })
        .select('date status cleaning_plan')
        .sort({ date: 1 })
        .lean();
    if (activeShifts.length) {
        throw new AppError(
            httpStatus.CONFLICT,
            `This worker is still assigned to ${activeShifts.length} upcoming or in-progress shift(s). Remove the worker from those shifts before deleting.`,
            '',
            {
                shifts: activeShifts.map((shift) => ({
                    shift: shift._id,
                    date: shift.date,
                    status: shift.status,
                    cleaning_plan: shift.cleaning_plan,
                })),
            }
        );
    }

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

interface WorkerShiftStats {
    total_shift: number;
    total_late_check_ins: number;
    total_on_time_check_ins: number;
    total_absent: number;
}

/**
 * All-time shift stats for a batch of workers in one query, not one per
 * worker. late/on-time/absent are mutually exclusive — a worker who checked
 * in late was not absent.
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
        .select('date date_time assigned_workers.worker assigned_workers.check_in_at')
        .lean();

    for (const shift of shifts) {
        for (const aw of shift.assigned_workers) {
            const workerId = aw.worker.toString();
            if (!idSet.has(workerId)) continue;

            const stats =
                statsByWorker.get(workerId) ??
                ({
                    total_shift: 0,
                    total_late_check_ins: 0,
                    total_on_time_check_ins: 0,
                    total_absent: 0,
                } satisfies WorkerShiftStats);
            statsByWorker.set(workerId, stats);

            stats.total_shift += 1;

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

    return statsByWorker;
};

const EMPTY_WORKER_SHIFT_STATS: WorkerShiftStats = {
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

// Lifetime attendance stats for one worker. late = checked in after the scheduled start;
// absent = past date, status not cancelled, never checked in.
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

    const attendanceStats = await getWorkerAttendanceStatsFromDB(worker._id);

    return {
        ...worker.toObject(),
        ...attendanceStats,
    };
};

const updateMyAvailabilityIntoDB = async (
    userId: string,
    payload: { working_days: string[] }
) => {
    const data = workerValidations.availabilityBody.parse(payload);
    const worker = await Worker.findOneAndUpdate(
        { user: userId, ...activeWorker },
        { $set: { working_days: data.working_days } },
        { new: true, runValidators: true }
    );
    if (!worker) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Active worker profile not found'
        );
    }
    return worker;
};

const getMyAvailabilityFromDB = async (userId: string) => {
    const worker = await Worker.findOne({ user: userId, ...activeWorker })
        .select('working_days worker_type')
        .lean();
    if (!worker) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Active worker profile not found'
        );
    }
    return {
        working_days: worker.working_days ?? [],
        worker_type: worker.worker_type,
    };
};

export default {
    getMyAvailabilityFromDB,
    updateMyAvailabilityIntoDB,
    createWorkerIntoDB,
    updateWorkerIntoDB,
    deleteWorkerFromDB,
    getAllWorkersFromDB,
    getSingleWorkerFromDB,
};
