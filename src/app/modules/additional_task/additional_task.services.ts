import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { IAdditionalTask } from './additional_task.interface';
import { AdditionalTask } from './additional_task.model';

const ensureCleaningPlanExists = async (planId: string) => {
    const plan = await CleaningPlan.findOne({ _id: planId, is_active: true });
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

// ─── Create (Client) ──────────────────────────────────────────────────────────

const createAdditionalTaskIntoDB = async (
    payload: Omit<IAdditionalTask, 'is_completed' | 'is_approved'>
) => {
    const plan = await ensureCleaningPlanExists(
        payload.cleaning_plan_id.toString()
    );

    const task = await AdditionalTask.create({
        ...payload,
        is_completed: false,
        is_approved: false,
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
    planId: string,
    query: Record<string, unknown>
) => {
    await ensureCleaningPlanExists(planId);

    const searchTerm = query.searchTerm as string | undefined;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort as string | undefined;

    const filters: Record<string, unknown> = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit', 'sort', 'fields'].includes(key)) {
            filters[key] = query[key];
        }
    });

    const sortOrder = sort?.startsWith('-') ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'created_at';

    const pipeline: PipelineStage[] = [
        {
            $match: {
                cleaning_plan_id: new Types.ObjectId(planId),
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
    const task = await AdditionalTask.findById(id);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');
    return task;
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
