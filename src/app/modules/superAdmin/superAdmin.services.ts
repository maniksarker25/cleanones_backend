/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import AppError from '../../error/appError';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import { ENUM_TASK_STATUS } from '../task/task.enum';
import TaskModel from '../task/task.model';
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

/** Task statuses that count as earnings */
const EARNING_STATUSES = [
    ENUM_TASK_STATUS.ASSIGNED,
    ENUM_TASK_STATUS.IN_PROGRESS,
    ENUM_TASK_STATUS.COMPLETED,
    ENUM_TASK_STATUS.ASSIGNED,
    ENUM_TASK_STATUS.IN_PROGRESS,
];

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

export const EarningsService = {
    async getEarningsMatrix({ filter, page, limit }: GetEarningsMatrixParams) {
        const validFilters: FilterType[] = [
            'today',
            'last_week',
            'last_month',
            'last_year',
        ];
        const safeFilter: FilterType = validFilters.includes(
            filter as FilterType
        )
            ? (filter as FilterType)
            : 'today';

        const { start, end } = getDateRange(safeFilter);
        const { start: prevStart, end: prevEnd } =
            getPreviousDateRange(safeFilter);

        // ── Base match shared by current & previous period queries ────────────
        const baseMatch = {
            status: { $in: EARNING_STATUSES },
            isDeleted: false,
            acceptedBidAmount: { $ne: null },
        };

        // ── 1. Current period: total earnings & paginated rows ────────────────
        const skip = (page - 1) * limit;

        const [currentPeriodData, previousPeriodData] = await Promise.all([
            // Current period aggregation
            TaskModel.aggregate([
                {
                    $match: {
                        ...baseMatch,
                        bidAcceptAt: { $gte: start, $lte: end },
                    },
                },
                {
                    $addFields: {
                        // Admin earning = acceptedBidAmount × (platformFeePercentage / 100)
                        adminEarning: {
                            $multiply: [
                                '$acceptedBidAmount',
                                {
                                    $divide: [
                                        {
                                            $ifNull: [
                                                '$platformFeePercentage',
                                                0,
                                            ],
                                        },
                                        100,
                                    ],
                                },
                            ],
                        },
                    },
                },
                {
                    $facet: {
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    totalEarnings: { $sum: '$adminEarning' },
                                    totalTasks: { $sum: 1 },
                                },
                            },
                        ],
                        rows: [
                            { $sort: { bidAcceptAt: -1 } },
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $project: {
                                    _id: 1,
                                    payOn: '$bidAcceptAt',
                                    txnId: '$transactionId',
                                    status: 1,
                                    acceptedBidAmount: 1,
                                    platformFeePercentage: 1,
                                    adminEarning: 1,
                                },
                            },
                        ],
                        // Total count for pagination
                        totalCount: [{ $count: 'count' }],
                    },
                },
            ]),

            TaskModel.aggregate([
                {
                    $match: {
                        ...baseMatch,
                        bidAcceptAt: { $gte: prevStart, $lte: prevEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalEarnings: {
                            $sum: {
                                $multiply: [
                                    '$acceptedBidAmount',
                                    {
                                        $divide: [
                                            {
                                                $ifNull: [
                                                    '$platformFeePercentage',
                                                    0,
                                                ],
                                            },
                                            100,
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            ]),
        ]);

        // ── Shape the response ────────────────────────────────────────────────
        const summary = currentPeriodData[0]?.summary?.[0] ?? {
            totalEarnings: 0,
            totalTasks: 0,
        };
        const rows = currentPeriodData[0]?.rows ?? [];
        const totalCount = currentPeriodData[0]?.totalCount?.[0]?.count ?? 0;

        const prevTotal = previousPeriodData?.[0]?.totalEarnings ?? 0;
        const currentTotal: number = summary.totalEarnings ?? 0;

        // Percentage change vs previous period (null when there's no previous data)
        let percentageChange: number | null = null;
        let changeDirection: 'higher' | 'lower' | 'same' | null = null;

        if (prevTotal > 0) {
            percentageChange = parseFloat(
                (((currentTotal - prevTotal) / prevTotal) * 100).toFixed(2)
            );
            changeDirection =
                percentageChange > 0
                    ? 'higher'
                    : percentageChange < 0
                      ? 'lower'
                      : 'same';
        }

        // Add a human-readable serial number to each row
        const rowsWithSerial = rows.map((row: any, index: number) => ({
            ...row,
            sl: String(skip + index + 1).padStart(2, '0'),
        }));

        return {
            filter: safeFilter,
            filterLabel: getLabelForFilter(safeFilter),
            summary: {
                totalEarnings: parseFloat(currentTotal.toFixed(2)),
                totalTasks: summary.totalTasks,
                percentageChange,
                changeDirection,
                comparedTo: getComparedToLabel(safeFilter),
            },
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
            },
            data: rowsWithSerial,
        };
    },
};

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
