import httpStatus from 'http-status';
import AppError from '../../error/appError';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import clientServices from './client.services';
import { TRosterView } from '../shift/shift.services';

const createClient = catchAsync(async (req, res) => {
    const result = await clientServices.createClientIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client created successfully',
        data: result,
    });
});

const updateClient = catchAsync(async (req, res) => {
    const result = await clientServices.updateClientIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client updated successfully',
        data: result,
    });
});

const deleteClient = catchAsync(async (req, res) => {
    const result = await clientServices.deleteClientFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client deleted successfully',
        data: result,
    });
});

const getAllClients = catchAsync(async (req, res) => {
    const result = await clientServices.getAllClientsFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Clients retrieved successfully',
        data: result,
    });
});

const getClientOverview = catchAsync(async (req, res) => {
    const result = await clientServices.getClientOverviewFromDB(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client overview retrieved successfully',
        data: result,
    });
});

const getClientScheduleRoster = catchAsync(async (req, res) => {
    const result = await clientServices.getClientScheduleRosterFromDB(
        req.user.profileId as string,
        req.query.date as string | undefined
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client schedule roster retrieved successfully',
        data: result,
    });
});

const getClientActiveProgress = catchAsync(async (req, res) => {
    const result = await clientServices.getClientActiveProgressFromDB(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client active progress retrieved successfully',
        data: result,
    });
});

const getClientShiftStats = catchAsync(async (req, res) => {
    const result = await clientServices.getClientShiftStatsFromDB(
        req.user.profileId as string,
        req.query.range as string | undefined
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client shift stats retrieved successfully',
        data: result,
    });
});

const getClientTotals = catchAsync(async (req, res) => {
    const result = await clientServices.getClientTotalsFromDB(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client totals retrieved successfully',
        data: result,
    });
});

const ROSTER_VIEWS = ['day', 'week', 'month'] as const;

const getClientPlanRoster = catchAsync(async (req, res) => {
    const view = (req.query.view as string | undefined) ?? 'day';
    if (!ROSTER_VIEWS.includes(view as (typeof ROSTER_VIEWS)[number])) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "view must be one of 'day', 'week', 'month'"
        );
    }

    const date = req.query.date as string | undefined;
    const year = req.query.year !== undefined ? Number(req.query.year) : undefined;
    const month = req.query.month !== undefined ? Number(req.query.month) : undefined;
    if (year !== undefined && Number.isNaN(year)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid year');
    }
    if (month !== undefined && Number.isNaN(month)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid month');
    }

    const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    if (page !== undefined && (Number.isNaN(page) || page < 1)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'page must be a positive integer');
    }
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1 || limit > 50)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'limit must be between 1 and 50');
    }

    const result = await clientServices.getClientPlanRosterFromDB(
        req.user.profileId as string,
        {
            view: view as TRosterView,
            date,
            year,
            month,
            page,
            limit,
        }
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client plan roster retrieved successfully',
        data: result,
    });
});

const clientController = {
    createClient,
    updateClient,
    deleteClient,
    getAllClients,
    getClientOverview,
    getClientScheduleRoster,
    getClientActiveProgress,
    getClientShiftStats,
    getClientTotals,
    getClientPlanRoster,
};

export default clientController;
