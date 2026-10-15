import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
} from '../company/company.scope';
import { Shift } from './shift.model';

const SHIFT_STATUSES = ['upcoming', 'in_progress', 'completed', 'cancelled'];
const MAX_PAGE_SIZE = 100;

const parseDate = (value: unknown, label: string): Date => {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${label}`);
    }
    return normalizeToUTCDateOnly(date);
};

const parseObjectId = (value: unknown, label: string): Types.ObjectId => {
    if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${label}`);
    }
    return new Types.ObjectId(value);
};

const getAllShiftsForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || 10));

    const filter: Record<string, unknown> = { manager: { $in: managerIds } };

    if (query.date !== undefined && query.date !== '') {
        filter.date = parseDate(query.date, 'date');
    } else if (query.from || query.to) {
        const range: Record<string, Date> = {};
        if (query.from) range.$gte = parseDate(query.from, 'from');
        if (query.to) range.$lte = parseDate(query.to, 'to');
        filter.date = range;
    }
    if (query.status !== undefined && query.status !== '') {
        if (!SHIFT_STATUSES.includes(String(query.status))) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Invalid status. Allowed: ${SHIFT_STATUSES.join(', ')}`
            );
        }
        filter.status = query.status;
    }
    if (query.cleaning_plan) {
        filter.cleaning_plan = parseObjectId(query.cleaning_plan, 'cleaning_plan');
    }
    if (query.location) {
        filter['location.location'] = parseObjectId(query.location, 'location');
    }

    const [result, total] = await Promise.all([
        Shift.find(filter)
            .select('-rooms -tasks')
            .sort({ date: -1, date_time: -1, _id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate(MANAGER_BRIEF)
            .populate({ path: 'cleaning_plan', select: 'title client' })
            .populate({ path: 'assigned_workers.worker', select: 'name phone' })
            .lean(),
        Shift.countDocuments(filter),
    ]);

    return {
        meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
        result,
    };
};

const getSingleShiftForCompany = async (companyId: string, id: string) => {
    assertValidId(id, 'shift');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const shift = await Shift.findOne({ _id: id, manager: { $in: managerIds } })
        .populate(MANAGER_BRIEF)
        .populate({ path: 'cleaning_plan', select: 'title client' })
        .populate({ path: 'assigned_workers.worker', select: 'name phone' })
        .lean();
    if (!shift) throw new AppError(httpStatus.NOT_FOUND, 'Shift not found');
    return shift;
};

const getTodayShiftMetaForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);
    const today = normalizeToUTCDateOnly(new Date());

    const rows = await Shift.aggregate<{ _id: string; count: number }>([
        {
            $match: {
                manager: { $in: managerIds },
                date: today,
                status: { $ne: 'cancelled' },
            },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const countOf = (status: string) =>
        rows.find((row) => row._id === status)?.count ?? 0;

    return {
        today_total_shift: rows.reduce((sum, row) => sum + row.count, 0),
        today_total_pending_shift: countOf('upcoming'),
        today_total_in_progress_shift: countOf('in_progress'),
        today_total_completed_shift: countOf('completed'),
    };
};

export default {
    getAllShiftsForCompany,
    getSingleShiftForCompany,
    getTodayShiftMetaForCompany,
};
