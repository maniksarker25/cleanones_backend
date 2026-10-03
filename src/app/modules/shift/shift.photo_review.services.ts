import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Location } from '../location/location.model';
import { Task } from '../task/task.model';
import { Shift } from './shift.model';
import { getShiftOrThrow } from './shift.shared.util';

/** Makes an approved photo the reference for future shifts — writes to the source Task, not this shift's snapshot. */
const promoteApprovedPhotoToReference = async (
    taskId: string,
    title: string,
    photoUrl: string
) => {
    try {
        await Task.updateOne(
            { _id: new Types.ObjectId(taskId) },
            { $set: { 'photo_requirements.$[p].reference_image_url': photoUrl } },
            { arrayFilters: [{ 'p.title': title }] }
        );
    } catch {
        // A verdict must still be recorded if this fails.
    }
};

/** Records a manager's decision on one photo — a quality record, doesn't reopen the task or touch is_completed. */
export const setPhotoVerdict = async (
    managerId: string,
    planId: string,
    date: Date,
    taskId: string,
    title: string,
    verdict: 'approved' | 'rejected',
    note?: string
) => {
    const shift = await getShiftOrThrow(planId, date);

    const task = shift.tasks.find((t) => t.task.toString() === taskId);
    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found on this shift');
    }
    const requirement = task.photo_requirements.find((p) => p.title === title);
    if (!requirement) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Unknown photo requirement "${title}" for this task`
        );
    }
    if (!requirement.is_uploaded) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'No photo has been uploaded for this requirement yet'
        );
    }

    await Shift.updateOne(
        { _id: shift._id },
        {
            $set: {
                'tasks.$[t].photo_requirements.$[p].manager_verdict': verdict,
                'tasks.$[t].photo_requirements.$[p].manager_verdict_by':
                    new Types.ObjectId(managerId),
                'tasks.$[t].photo_requirements.$[p].manager_verdict_at': new Date(),
                'tasks.$[t].photo_requirements.$[p].manager_note': note ?? null,
                // Leaves the queue — must not be picked up by the auto-accept sweep later.
                'tasks.$[t].photo_requirements.$[p].auto_accepted': false,
            },
        },
        {
            arrayFilters: [
                { 't.task': new Types.ObjectId(taskId) },
                { 'p.title': title },
            ],
        }
    );

    if (verdict === 'approved' && requirement.photo_url) {
        await promoteApprovedPhotoToReference(
            taskId,
            title,
            requirement.photo_url
        );
    }

    return Shift.findById(shift._id);
};

export interface PhotoReviewQueryParams {
    from?: Date;
    to?: Date;
    planId?: string;
    locationId?: string;
    /** 'pending' keeps only rows a manager has not decided on yet. */
    status?: 'pending' | 'decided' | 'all';
}

export interface PhotoReviewPhoto {
    title: string;
    photo_url: string;
    description: string | null;
    reference_image_url: string | null;

    ai_status: string | null;
    ai_score: number | null;
    ai_confidence: number | null;
    ai_reason: string | null;
    ai_checks: { item: string; passed: boolean | null; note?: string }[];
    ai_subject_matches: boolean | null;
    ai_requirement_met: boolean | null;
    ai_evaluated_at: Date | null;

    gate_status: string | null;
    gate_reason: string | null;
    attempt_count: number;
    forced_accept: boolean;
    audit_sampled: boolean;

    manager_verdict: 'approved' | 'rejected' | null;
    manager_verdict_at: Date | null;
    manager_note: string | null;
    auto_decided: boolean;
    auto_decision: 'approved' | 'rejected' | null;
    escalated_at: Date | null;
    auto_accepted: boolean;
}

export interface PhotoReviewRow {
    /** Identifiers the manager UI needs to submit a verdict. */
    shift_id: string;
    plan_id: string;
    task_id: string;
    shift_date: Date;

    cleaning_name: string;
    room_name: string;
    task_name: string;
    duration_minutes: number;
    location_name: string;
    address: string | null;

    /** Lower sorts first. Drives the default queue order. */
    review_priority: number;
    /** True while at least one photo still needs a manager decision. */
    needs_review: boolean;

    uploaded_photos: PhotoReviewPhoto[];
}

/** Queue position for one photo — forced-accepts and wrong-subject photos rank above borderline scores. */
const photoReviewPriority = (photo: PhotoReviewPhoto): number => {
    if (photo.manager_verdict) return 90;
    if (photo.auto_decided) return 85;
    // A clean AI pass settles it regardless of how many retries it took.
    if (photo.ai_status === 'passed') return 80;
    if (photo.forced_accept) return 1;
    if (photo.ai_subject_matches === false) return 2;
    if (photo.ai_status === 'failed') return 3;
    if (photo.ai_status === 'review') return 4;
    if (photo.audit_sampled) return 5;
    if (photo.ai_status === 'error' || photo.ai_status === 'pending') return 6;
    if (!photo.ai_status) return 7;
    return 8;
};

/** Whether a photo still needs a human eye — a clean AI verdict settles it unless the audit sampler pulled it. */
const photoNeedsReview = (photo: PhotoReviewPhoto): boolean => {
    if (photo.manager_verdict) return false;
    if (photo.auto_decided) return photo.audit_sampled;
    if (photo.auto_accepted) return false;
    if (photo.ai_status === 'passed') return photo.audit_sampled;
    return true;
};

/**
 * Manager-facing photo review list: one row per shift task instance that has
 * at least one uploaded photo, across shifts in the given date range
 * (default: the last 30 days through today), optionally narrowed to one
 * cleaning plan or location.
 */
export const getPhotoReviewListFromDB = async (
    params: PhotoReviewQueryParams
): Promise<PhotoReviewRow[]> => {
    const to = params.to ?? new Date();
    const from =
        params.from ??
        (() => {
            const d = new Date(to);
            d.setUTCDate(d.getUTCDate() - 30);
            return d;
        })();

    const filter: Record<string, unknown> = { date: { $gte: from, $lte: to } };
    if (params.planId) filter.cleaning_plan = new Types.ObjectId(params.planId);
    if (params.locationId)
        filter['location.location'] = new Types.ObjectId(params.locationId);

    const shifts = await Shift.find(filter)
        .select('cleaning_plan date location rooms tasks')
        .sort({ date: -1 })
        .lean();

    if (!shifts.length) return [];

    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const locationIds = [
        ...new Set(shifts.map((s) => s.location.location.toString())),
    ];

    const [plans, locations] = await Promise.all([
        CleaningPlan.find({ _id: { $in: planIds } }).select('title').lean(),
        Location.find({ _id: { $in: locationIds } }).select('address').lean(),
    ]);

    const planTitleById = new Map(plans.map((p) => [p._id.toString(), p.title]));
    const addressById = new Map(
        locations.map((l) => [l._id.toString(), l.address])
    );

    const rows: PhotoReviewRow[] = [];

    for (const shift of shifts) {
        const roomNameByRoomId = new Map(
            shift.rooms.map((r) => [r.room.toString(), r.name])
        );
        const cleaningName =
            planTitleById.get(shift.cleaning_plan.toString()) ?? '';
        const address = addressById.get(shift.location.location.toString()) ?? null;

        for (const task of shift.tasks) {
            if (!task.is_photo_required) continue;
            const uploadedPhotos: PhotoReviewPhoto[] = task.photo_requirements
                .filter((p) => p.is_uploaded)
                .map((p) => ({
                    title: p.title,
                    photo_url: p.photo_url as string,
                    description: p.description ?? null,
                    reference_image_url: p.reference_image_url ?? null,

                    ai_status: p.ai_status ?? null,
                    ai_score: p.ai_score ?? null,
                    ai_confidence: p.ai_confidence ?? null,
                    ai_reason: p.ai_reason ?? null,
                    ai_checks: p.ai_checks ?? [],
                    ai_subject_matches: p.ai_subject_matches ?? null,
                    ai_requirement_met: p.ai_requirement_met ?? null,
                    ai_evaluated_at: p.ai_evaluated_at ?? null,

                    gate_status: p.gate_status ?? null,
                    gate_reason: p.gate_reason ?? null,
                    attempt_count: p.attempt_count ?? 0,
                    forced_accept: p.forced_accept ?? false,
                    audit_sampled: p.audit_sampled ?? false,

                    manager_verdict: p.manager_verdict ?? null,
                    manager_verdict_at: p.manager_verdict_at ?? null,
                    manager_note: p.manager_note ?? null,
                    auto_decided: p.auto_decided ?? false,
                    auto_decision: p.auto_decision ?? null,
                    escalated_at: p.escalated_at ?? null,
                    auto_accepted: p.auto_accepted ?? false,
                }));
            if (!uploadedPhotos.length) continue;

            const priority = Math.min(
                ...uploadedPhotos.map((p) => photoReviewPriority(p))
            );
            const needsReview = uploadedPhotos.some(photoNeedsReview);

            if (params.status === 'pending' && !needsReview) continue;
            if (params.status === 'decided' && needsReview) continue;

            rows.push({
                shift_id: shift._id.toString(),
                plan_id: shift.cleaning_plan.toString(),
                task_id: task.task.toString(),
                shift_date: shift.date,

                cleaning_name: cleaningName,
                room_name: task.room ? roomNameByRoomId.get(task.room.toString()) ?? '' : '',
                task_name: task.name,
                duration_minutes: task.duration_minutes,
                location_name: shift.location.name,
                address,

                review_priority: priority,
                needs_review: needsReview,
                uploaded_photos: uploadedPhotos,
            });
        }
    }

    // Most urgent first, then newest.
    rows.sort(
        (a, b) =>
            a.review_priority - b.review_priority ||
            b.shift_date.getTime() - a.shift_date.getTime()
    );

    return rows;
};
