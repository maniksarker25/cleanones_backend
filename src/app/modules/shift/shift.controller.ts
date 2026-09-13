import httpStatus from 'http-status';
import AppError from '../../error/appError';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import shiftServices from './shift.services';
import shiftValidations from './shift.validation';

const listMyShifts = catchAsync(async (req, res) => {
    const { date } = shiftValidations.workerShiftsQuery.parse(req.query);
    const result = await shiftServices.listWorkerShiftsForDate(
        req.user.profileId as string,
        new Date(date)
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shifts retrieved successfully',
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
    const result = await shiftServices.getShiftForDate(
        req.params.planId,
        date
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

const shiftController = {
    listMyShifts,
    listShifts,
    getShift,
    assignWorkers,
    updateStatus,
};

export default shiftController;
