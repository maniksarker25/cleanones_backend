import httpStatus from 'http-status';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { toManagerObjectId } from '../../utilities/managerScope';
import { emitAppEvent } from '../../events/eventEmitter';
import {
    anyPatternOccursOnDate,
    normalizeToUTCDateOnly,
} from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import cleaningPlanServices from '../cleaning_plan/cleaning_plan.services';
import { resyncTodayShiftAdditionalTaskIfDue } from '../shift/shift.services';
import { Shift } from '../shift/shift.model';
import { buildShiftSnapshot } from '../shift/shift.snapshot.util';
import { IAdditionalTask, TAdditionalTaskStatus } from './additional_task.interface';
import { AdditionalTask } from './additional_task.model';
import { additionalTaskListQuerySchema } from './additional_task.validation';
import { USER_ROLE } from '../user/user.constant';

type Requester = { role: string; profileId: string };

// Loads the plan and verifies the requester owns it: a client must be the
// plan's client, a manager must be the plan's manager. A foreign plan is
// reported as missing so its existence isn't confirmed.
const ensureCleaningPlanExists = async (
    planId: string,
    requester: Requester
) => {
    const plan = await CleaningPlan.findOne({ _id: planId, is_active: true });
    const owner =
        requester.role === USER_ROLE.manager ? plan?.manager : plan?.client;
    if (!plan || owner?.toString() !== requester.profileId)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

// A manager owns the additional tasks of their own plans (the task carries a
// denormalized `manager`); a client owns those of plans that are theirs. Throws
// 404 rather than 403 so a foreign requester can't distinguish "not yours" from
// "doesn't exist".
const ensureRequesterOwnsAdditionalTask = async (
    task: Pick<IAdditionalTask, 'manager' | 'cleaning_plan_id'>,
    requester: Requester,
    notFoundMessage = 'Additional task not found'
) => {
    if (requester.role === USER_ROLE.manager) {
        if (task.manager.toString() !== requester.profileId) {
            throw new AppError(httpStatus.NOT_FOUND, notFoundMessage);
        }
        return;
    }
    const plan = await CleaningPlan.findById(task.cleaning_plan_id)
        .select('client')
        .lean();
    if (!plan || plan.client.toString() !== requester.profileId) {
        throw new AppError(httpStatus.NOT_FOUND, notFoundMessage);
    }
};

// A started or finished shift never picks up new additional tasks (resync only
// folds into 'upcoming' shifts), so one added for that day would sit approved
// but never reach the crew or the shift's pay cap. Refuse it up front.
const assertShiftNotStartedForDay = async (
    planId: Types.ObjectId | string,
    dateTime: Date
) => {
    const started = await Shift.exists({
        cleaning_plan: planId,
        date: normalizeToUTCDateOnly(dateTime),
        status: { $in: ['in_progress', 'completed'] },
    });
    if (started) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'The shift for this date has already started or completed, so an additional task cannot be added to it'
        );
    }
};

// ─── Create (Client) ──────────────────────────────────────────────────────────

const createAdditionalTaskIntoDB = async (
    payload: Omit<IAdditionalTask, 'is_completed' | 'status' | 'manager'>,
    requester: Requester
) => {
    const requesterRole = requester.role;
    const plan = await ensureCleaningPlanExists(
        payload.cleaning_plan_id.toString(),
        requester
    );

    // date_time only needs to fall on a date this plan actually has an
    // occurrence on (per its tasks' recurrence patterns) — the time-of-day
    // isn't checked against any shift's start/end window. Matches the same
    // "no occurrence on the given date" validation assignWorkersToShift and
    // listEligibleWorkersForShift already do — a materialized Shift row
    // doesn't need to exist yet (see resyncTodayShiftAdditionalTaskIfDue /
    // getOrCreateBareShift, which fold an approved additional task in
    // whenever that day's shift eventually gets created).
    const snapshot = await buildShiftSnapshot(plan);
    const day = normalizeToUTCDateOnly(payload.date_time);
    if (!anyPatternOccursOnDate(snapshot.patterns, day)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This cleaning plan has no occurrence on the given date'
        );
    }

    await assertShiftNotStartedForDay(plan._id, payload.date_time);

    const task = await AdditionalTask.create({
        ...payload,
        manager: plan.manager,
        is_completed: false,
        status: requesterRole === USER_ROLE.manager ? 'Approved' : 'Pending',
    });

    // A manager creating one directly is auto-approved (see status
    // above) — there's nothing pending for other managers to review, so only
    // notify when this actually came from a client request.
    if (requesterRole !== USER_ROLE.manager) {
        emitAppEvent('additional_task.created', {
            taskId: task._id.toString(),
            planId: plan._id.toString(),
            clientId: plan.client.toString(),
            name: task.name,
        });
    } else {
        // Auto-approved — fold it into today's shift right away if that
        // shift is already materialized, same as an explicit manager approval.
        await resyncTodayShiftAdditionalTaskIfDue(task);
    }

    return task;
};

// ─── Update (Client) ──────────────────────────────────────────────────────────

const updateAdditionalTaskIntoDB = async (
    id: string,
    payload: Partial<IAdditionalTask>,
    requester: Requester
) => {
    const task = await AdditionalTask.findById(id);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');
    await ensureRequesterOwnsAdditionalTask(task, requester);

    // prevent the requester from touching approval or tenancy fields
    delete (payload as { manager?: unknown }).manager;
    delete (payload as { cleaning_plan_id?: unknown }).cleaning_plan_id;
    delete payload.status;
    delete payload.reject_reason;

    if (payload.date_time) {
        await assertShiftNotStartedForDay(task.cleaning_plan_id, payload.date_time);
    }

    const result = await AdditionalTask.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
};

// ─── Approve (Manager) ────────────────────────────────────────────────────────

const approveAdditionalTaskIntoDB = async (
    managerId: string,
    id: string,
    status: Extract<TAdditionalTaskStatus, 'Approved' | 'Rejected'>,
    rejectReason?: string,
    // Manager-adjusted duration/photo requirements, applied only when
    // approving (see additional_task.validation.ts's approve schema) — lets
    // the manager correct the client's proposed values as part of the same
    // approval call instead of a separate update-additional-task request.
    overrides?: {
        duration_minutes?: number | null;
        photo_requirements?: IAdditionalTask['photo_requirements'];
    }
) => {
    const task = await AdditionalTask.findOne({
        _id: id,
        manager: toManagerObjectId(managerId),
    });
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');

    if (status === 'Approved' && task.status !== 'Approved') {
        await assertShiftNotStartedForDay(task.cleaning_plan_id, task.date_time);
    }

    const result = await AdditionalTask.findByIdAndUpdate(
        id,
        {
            status,
            // Approving always clears out any reason left over from a
            // previous rejection.
            reject_reason: status === 'Rejected' ? rejectReason : null,
            ...(status === 'Approved' && overrides?.duration_minutes !== undefined && {
                duration_minutes: overrides.duration_minutes,
            }),
            ...(status === 'Approved' && overrides?.photo_requirements !== undefined && {
                photo_requirements: overrides.photo_requirements,
                is_photo_required: overrides.photo_requirements.length > 0,
            }),
        },
        { new: true, runValidators: true }
    );

    if (result) {
        const plan = await CleaningPlan.findById(result.cleaning_plan_id)
            .select('client')
            .lean();
        if (plan) {
            emitAppEvent(
                status === 'Approved'
                    ? 'additional_task.approved'
                    : 'additional_task.rejected',
                {
                    taskId: result._id.toString(),
                    planId: result.cleaning_plan_id.toString(),
                    clientId: plan.client.toString(),
                    name: result.name,
                    ...(status === 'Rejected' && {
                        rejectReason: result.reject_reason ?? undefined,
                    }),
                }
            );
        }

        // Newly approved (wasn't already) — fold it into that day's shift
        // right away if the shift is already materialized, instead of
        // waiting for the next materialization to pick it up.
        if (status === 'Approved' && task.status !== 'Approved') {
            await resyncTodayShiftAdditionalTaskIfDue(result);
        }
    }

    return result;
};

// ─── Delete (Client) ──────────────────────────────────────────────────────────

const deleteAdditionalTaskFromDB = async (
    id: string,
    requester: Requester
) => {
    const task = await AdditionalTask.findById(id);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');
    await ensureRequesterOwnsAdditionalTask(task, requester);

    await AdditionalTask.findByIdAndDelete(id);
    return { message: 'Additional task deleted successfully' };
};

// ─── Get all by Cleaning Plan ─────────────────────────────────────────────────

const getAllAdditionalTasksByPlanFromDB = async (
    query: Record<string, unknown>,
    requester: Requester
) => {
    const parsed = additionalTaskListQuerySchema.safeParse(query);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AppError(httpStatus.BAD_REQUEST, `${issue.path.join('.')}: ${issue.message}`);
    }
    const { planId, client, searchTerm, sort } = parsed.data;
    const filters: Record<string, unknown> = {};
    if (planId) {
        await ensureCleaningPlanExists(planId, requester);
        filters.cleaning_plan_id = new Types.ObjectId(planId);
    } else if (requester.role === USER_ROLE.client) {
        // Always self-scoped — the `client` query param (manager-only) is
        // never honored here, so a client can't widen their own view.
        const plans = await CleaningPlan.find({ client: requester.profileId, is_active: true }).select('_id');
        filters.cleaning_plan_id = { $in: plans.map((plan) => plan._id) };
    } else if (client) {
        const plans = await CleaningPlan.find({
            client,
            manager: toManagerObjectId(requester.profileId),
            is_active: true,
        }).select('_id');
        // An empty $in never matches — correctly yields zero results instead
        // of accidentally falling through to "no client filter at all".
        filters.cleaning_plan_id = { $in: plans.map((plan) => plan._id) };
    }

    // A manager's listing is always confined to their own tenant, whichever
    // filter branch above applied.
    if (requester.role === USER_ROLE.manager) {
        filters.manager = toManagerObjectId(requester.profileId);
    }

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? 10;
    const skip = (page - 1) * limit;
    for (const key of ['status', 'is_completed', 'is_photo_required'] as const) {
        if (parsed.data[key] !== undefined) {
            filters[key] = parsed.data[key];
        }
    }

    const sortOrder = sort ? (sort.startsWith('-') ? -1 : 1) : -1;
    const sortField = sort ? sort.replace(/^-/, '') : 'createdAt';

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
                // Adds `cleaning_plan` (title + its location's name/address)
                // alongside the existing `cleaning_plan_id` — that field stays
                // a plain id so nothing already reading it as a string breaks.
                {
                    $lookup: {
                        from: 'cleaning_plans',
                        localField: 'cleaning_plan_id',
                        foreignField: '_id',
                        as: 'cleaning_plan',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'locations',
                                    localField: 'location',
                                    foreignField: '_id',
                                    as: 'location',
                                    pipeline: [
                                        { $project: { name: 1, address: 1 } },
                                    ],
                                },
                            },
                            {
                                $unwind: {
                                    path: '$location',
                                    preserveNullAndEmptyArrays: true,
                                },
                            },
                            { $project: { title: 1, location: 1 } },
                        ],
                    },
                },
                {
                    $unwind: {
                        path: '$cleaning_plan',
                        preserveNullAndEmptyArrays: true,
                    },
                },
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

const getSingleAdditionalTaskFromDB = async (
    id: string,
    requester: Requester
) => {
    const task = await AdditionalTask.findById(id).lean();
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');
    await ensureRequesterOwnsAdditionalTask(task, requester);

    const cleaningPlan = await cleaningPlanServices.getSingleCleaningPlanFromDB(
        requester,
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
