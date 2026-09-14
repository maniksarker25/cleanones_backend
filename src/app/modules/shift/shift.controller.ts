import httpStatus from 'http-status';
import AppError from '../../error/appError';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import { USER_ROLE } from '../user/user.constant';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import shiftServices from './shift.services';
import shiftValidations from './shift.validation';

const listMyShifts = catchAsync(async (req, res) => {
    const { date } = shiftValidations.workerShiftsQuery.parse(req.query);
    const result = await shiftServices.listWorkerShiftsForDate(
        req.user.profileId as string,
        new Date(date)
    );
    const plans = result.length
        ? await CleaningPlan.find({
            _id: { $in: [...new Set(result.map((shift) => shift.cleaning_plan.toString()))] },
        }).select('title').lean()
        : [];
    const planTitles = new Map(plans.map((plan) => [plan._id.toString(), plan.title]));
    const shifts = result.map((shift) => ({
        ...shift,
        cleaning_plan: {
            _id: shift.cleaning_plan,
            title: planTitles.get(shift.cleaning_plan.toString()) ?? null,
        },
    }));
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shifts retrieved successfully',
        data: shifts,
    });
});

const getMyActiveShift = catchAsync(async (req, res) => {
    const result = await shiftServices.getActiveShiftForWorker(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Active shift retrieved successfully',
        data: result,
    });
});

const getMyTodayMeta = catchAsync(async (req, res) => {
    const result = await shiftServices.getWorkerTodayMetaFromDB(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Today's shift metadata retrieved successfully",
        data: result,
    });
});

const getMyNextShift = catchAsync(async (req, res) => {
    const result = await shiftServices.getNextShiftForWorker(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Next shift retrieved successfully',
        data: result,
    });
});

const getTodayLiveShiftMeta = catchAsync(async (_req, res) => {
    const result = await shiftServices.getTodayLiveShiftMetaFromDB();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Today's live shift metadata retrieved successfully",
        data: result,
    });
});

const getTodayLiveShifts = catchAsync(async (req, res) => {
    const result = await shiftServices.getTodayLiveShiftsFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Today's live shifts retrieved successfully",
        data: result,
    });
});

const getSingleLiveShift = catchAsync(async (req, res) => {
    const result = await shiftServices.getSingleLiveShiftFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shift retrieved successfully',
        data: result,
    });
});

const getWorkerPerformance = catchAsync(async (req, res) => {
    const month = req.query.month !== undefined ? Number(req.query.month) : undefined;
    const year = req.query.year !== undefined ? Number(req.query.year) : undefined;
    if (month !== undefined && Number.isNaN(month)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid month');
    }
    if (year !== undefined && Number.isNaN(year)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid year');
    }

    const result = await shiftServices.getWorkerPerformanceFromDB(
        req.params.workerId,
        month,
        year
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker performance retrieved successfully',
        data: result,
    });
});

const getMyLiveStatus = catchAsync(async (req, res) => {
    const result = await shiftServices.getClientLiveShiftsFromDB(
        req.user.profileId as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Live shift status retrieved successfully',
        data: result,
    });
});

const parseDateParam = (value: string, label = 'date'): Date => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${label}: ${value}`);
    }
    return date;
};

const listShifts = catchAsync(async (req, res) => {
    const { from, to } = req.query;
    const fromDate = from
        ? parseDateParam(String(from), 'from')
        : new Date();
    const toDate = to
        ? parseDateParam(String(to), 'to')
        : (() => {
              const d = new Date(fromDate);
              d.setUTCDate(d.getUTCDate() + 30);
              return d;
          })();

    const result = await shiftServices.listShiftsInRange(
        req.params.planId,
        fromDate,
        toDate
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shifts retrieved successfully',
        data: result,
    });
});

const getShift = catchAsync(async (req, res) => {
    const date = parseDateParam(req.params.date);
    const requestingWorkerId =
        req.user.role === USER_ROLE.worker
            ? (req.user.profileId as string)
            : undefined;
    const result = await shiftServices.getShiftForDate(
        req.params.planId,
        date,
        requestingWorkerId
    );
    if (!result) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'This cleaning plan has no occurrence on the given date'
        );
    }
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shift retrieved successfully',
        data: result,
    });
});

const assignWorkers = catchAsync(async (req, res) => {
    const date = parseDateParam(req.params.date);
    const force = req.body.force === true || req.query.force === 'true';
    const result = await shiftServices.assignWorkersToShift(
        req.user.profileId as string,
        req.params.planId,
        date,
        req.body.assigned_workers,
        force
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shift workers assigned successfully',
        data: result,
    });
});

const updateStatus = catchAsync(async (req, res) => {
    const date = parseDateParam(req.params.date);
    const result = await shiftServices.updateShiftStatus(
        req.user.profileId as string,
        req.params.planId,
        date,
        req.body.status
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shift status updated successfully',
        data: result,
    });
});

const uploadTaskPhoto = catchAsync(async (req, res) => {
    const date = parseDateParam(req.params.date);
    const result = await shiftServices.uploadShiftTaskPhoto(
        req.user.profileId as string,
        req.params.planId,
        date,
        req.params.taskId,
        req.body.title,
        req.body.photo_url
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Photo uploaded successfully',
        data: result,
    });
});

const checkIn = catchAsync(async (req, res) => {
    const date = parseDateParam(req.params.date);
    const result = await shiftServices.checkInToShift(
        req.user.profileId as string,
        req.params.planId,
        date,
        [req.body.longitude, req.body.latitude]
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Checked in successfully',
        data: result,
    });
});

const checkOut = catchAsync(async (req, res) => {
    const date = parseDateParam(req.params.date);
    const result = await shiftServices.checkOutFromShift(
        req.user.profileId as string,
        req.params.planId,
        date,
        [req.body.longitude, req.body.latitude]
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Checked out successfully',
        data: result,
    });
});

const shiftController = {
    listMyShifts,
    getMyActiveShift,
    getMyTodayMeta,
    getMyNextShift,
    getTodayLiveShiftMeta,
    getTodayLiveShifts,
    getSingleLiveShift,
    getMyLiveStatus,
    getWorkerPerformance,
    listShifts,
    getShift,
    assignWorkers,
    updateStatus,
    uploadTaskPhoto,
    checkIn,
    checkOut,
};

export default shiftController;
