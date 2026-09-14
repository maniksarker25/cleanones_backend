import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import cleaningPlanServices from '../cleaning_plan/cleaning_plan.services';
import { IAdditionalTask } from './additional_task.interface';
import { AdditionalTask } from './additional_task.model';
import { additionalTaskListQuerySchema } from './additional_task.validation';
import { USER_ROLE } from '../user/user.constant';

const ensureCleaningPlanExists = async (planId: string) => {
    const plan = await CleaningPlan.findOne({ _id: planId, is_active: true });
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

// ─── Create (Client) ──────────────────────────────────────────────────────────

const createAdditionalTaskIntoDB = async (
    payload: Omit<IAdditionalTask, 'is_completed' | 'is_approved'>,
    requesterRole: string
) => {
    const plan = await ensureCleaningPlanExists(
        payload.cleaning_plan_id.toString()
    );

    const task = await AdditionalTask.create({
        ...payload,
        is_completed: false,
        is_approved: requesterRole === USER_ROLE.manager,
    });

    // push the new task id into the cleaning plan's additional_tasks array
    await CleaningPlan.findByIdAndUpdate(plan._id, {
        $push: { additional_tasks: task._id },
    });

    return task;
};

// ─── Update (Client) ──────────────────────────────────────────────────────────

const updateAdditionalTaskIntoDB = async (
    id: string,
    payload: Partial<IAdditionalTask>
) => {
    const task = await AdditionalTask.findById(id);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');

    // prevent client from touching approval fields
    delete (payload as any).is_approved;

    const result = await AdditionalTask.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
};

// ─── Approve (Manager) ────────────────────────────────────────────────────────

const approveAdditionalTaskIntoDB = async (
    id: string,
    is_approved: boolean
) => {
    const task = await AdditionalTask.findById(id);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');

    const result = await AdditionalTask.findByIdAndUpdate(
        id,
        { is_approved },
        { new: true, runValidators: true }
    );
    return result;
};

// ─── Delete (Client) ──────────────────────────────────────────────────────────

const deleteAdditionalTaskFromDB = async (id: string) => {
    const task = await AdditionalTask.findById(id);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');

    // pull the task id from the cleaning plan's additional_tasks array
    await CleaningPlan.findByIdAndUpdate(task.cleaning_plan_id, {
        $pull: { additional_tasks: task._id },
    });

    await AdditionalTask.findByIdAndDelete(id);
    return { message: 'Additional task deleted successfully' };
};

// ─── Get all by Cleaning Plan ─────────────────────────────────────────────────

const getAllAdditionalTasksByPlanFromDB = async (
    query: Record<string, unknown>,
    requester: { role: string; profileId: string }
) => {
    const parsed = additionalTaskListQuerySchema.safeParse(query);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AppError(httpStatus.BAD_REQUEST, `${issue.path.join('.')}: ${issue.message}`);
    }
    const { planId, searchTerm, sort } = parsed.data;
    const filters: Record<string, unknown> = {};
    if (planId) {
        const plan = await ensureCleaningPlanExists(planId);
        if (requester.role === USER_ROLE.client && plan.client.toString() !== requester.profileId) {
            throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
        }
        filters.cleaning_plan_id = new Types.ObjectId(planId);
    } else if (requester.role === USER_ROLE.client) {
        const plans = await CleaningPlan.find({ client: requester.profileId, is_active: true }).select('_id');
        filters.cleaning_plan_id = { $in: plans.map((plan) => plan._id) };
    }

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? 10;
    const skip = (page - 1) * limit;
    for (const key of ['is_approved', 'is_completed', 'is_photo_required'] as const) {
        if (parsed.data[key] !== undefined) {
            filters[key] = parsed.data[key];
        }
    }

    const sortOrder = sort?.startsWith('-') ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'created_at';

    const pipeline: PipelineStage[] = [
        {
            $match: {
                ...filters,
            },
        },
    ];

    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: ['name', 'description'].map((field) => ({
                    [field]: { $regex: searchTerm, $options: 'i' },
                })),
            },
        });
    }

    pipeline.push({
        $facet: {
            metadata: [{ $count: 'total' }],
            data: [
                { $sort: { [sortField]: sortOrder } },
                { $skip: skip },
                { $limit: limit },
            ],
        },
    });

    const [aggResult] = await AdditionalTask.aggregate(pipeline);

    const total = aggResult?.metadata?.[0]?.total || 0;
    const result = aggResult?.data || [];

    return {
        meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
        result,
    };
};

// ─── Get Single ───────────────────────────────────────────────────────────────

const getSingleAdditionalTaskFromDB = async (id: string) => {
    const task = await AdditionalTask.findById(id).lean();
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');
    const cleaningPlan = await cleaningPlanServices.getSingleCleaningPlanFromDB(
        task.cleaning_plan_id.toString()
    );
    return { ...task, cleaning_plan_id: cleaningPlan };
};

// ─────────────────────────────────────────────────────────────────────────────

const additionalTaskServices = {
    createAdditionalTaskIntoDB,
    updateAdditionalTaskIntoDB,
    approveAdditionalTaskIntoDB,
    deleteAdditionalTaskFromDB,
    getAllAdditionalTasksByPlanFromDB,
    getSingleAdditionalTaskFromDB,
};

export default additionalTaskServices;
