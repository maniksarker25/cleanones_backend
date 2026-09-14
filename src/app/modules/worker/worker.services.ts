import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import chatServices from '../chat/chat.services';
import { PROFILE_MODEL_BY_ROLE, USER_ROLE } from '../user/user.constant';
import { User } from '../user/user.model';
import { Worker } from './worker.model';
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
    const result = await workerQuery.modelQuery;
    return { meta, result };
};

const getSingleWorkerFromDB = async (id: string) => {
    validateId(id);
    const worker = await Worker.findOne({ _id: id, ...activeWorker });
    if (!worker) throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    return worker;
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
