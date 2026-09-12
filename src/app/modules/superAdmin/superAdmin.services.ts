/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import AppError from '../../error/appError';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import { ISuperAdmin } from './superAdmin.interface';
import SuperAdmin from './superAdmin.model';

const updateSuperAdminProfile = async (
    id: string,
    payload: Partial<ISuperAdmin>
) => {
    if (payload.email) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'You can not change the email'
        );
    }
    const user = await SuperAdmin.findById(id);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
    }
    const result = await SuperAdmin.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });

    if (payload.profile_image && user.profile_image) {
        deleteFileFromS3(user.profile_image);
    }
    return result;
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

type FilterType = 'today' | 'last_week' | 'last_month' | 'last_year';

function getDateRange(filter: FilterType): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);

    let start: Date;

    switch (filter) {
        case 'today': {
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'last_week': {
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'last_month': {
            start = new Date(now);
            start.setMonth(now.getMonth() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'last_year': {
            start = new Date(now);
            start.setFullYear(now.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        }
        default: {
            // fallback to today
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
        }
    }

    return { start, end };
}

/**
 * Returns the equivalent "previous period" range so we can calculate
 * the percentage change shown in the UI (e.g. "5% Higher Than Yesterday").
 */
function getPreviousDateRange(filter: FilterType): { start: Date; end: Date } {
    const now = new Date();

    switch (filter) {
        case 'today': {
            const start = new Date(now);
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'last_week': {
            const start = new Date(now);
            start.setDate(now.getDate() - 14);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setDate(now.getDate() - 7);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'last_month': {
            const start = new Date(now);
            start.setMonth(now.getMonth() - 2);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setMonth(now.getMonth() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'last_year': {
            const start = new Date(now);
            start.setFullYear(now.getFullYear() - 2);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setFullYear(now.getFullYear() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        default: {
            const start = new Date(now);
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
    }
}

// ─── Service ─────────────────────────────────────────────────────────────────

interface GetEarningsMatrixParams {
    filter: string;
    page: number;
    limit: number;
}


// ─── Label helpers ────────────────────────────────────────────────────────────

function getLabelForFilter(filter: FilterType): string {
    const labels: Record<FilterType, string> = {
        today: 'Today',
        last_week: 'Last Week',
        last_month: 'Last Month',
        last_year: 'Last Year',
    };
    return labels[filter];
}

function getComparedToLabel(filter: FilterType): string {
    const labels: Record<FilterType, string> = {
        today: 'Yesterday',
        last_week: 'Previous Week',
        last_month: 'Previous Month',
        last_year: 'Previous Year',
    };
    return labels[filter];
}

const SuperAdminServices = {
    updateSuperAdminProfile,
};

export default SuperAdminServices;
