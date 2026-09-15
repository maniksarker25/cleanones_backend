import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import shiftController from './shift.controller';
import shiftValidations from './shift.validation';

const router = Router();

router.get('/my-shifts', auth(USER_ROLE.worker), shiftController.listMyShifts);

router.get(
    '/my-active-shift',
    auth(USER_ROLE.worker),
    shiftController.getMyActiveShift
);

router.get(
    '/my-today-meta',
    auth(USER_ROLE.worker),
    shiftController.getMyTodayMeta
);

router.get(
    '/my-next-shift',
    auth(USER_ROLE.worker),
    shiftController.getMyNextShift
);

router.get(
    '/my-live-status',
    auth(USER_ROLE.client),
    shiftController.getMyLiveStatus
);

router.get(
    '/worker-performance/:workerId',
    auth(USER_ROLE.manager),
    shiftController.getWorkerPerformance
);

router.get(
    '/attendance-summary',
    auth(USER_ROLE.manager),
    shiftController.getWorkersAttendanceSummary
);

router.get(
    '/attendance-summary/:workerId',
    auth(USER_ROLE.manager),
    shiftController.getWorkerAttendanceSummary
);

router.get(
    '/attendance-list',
    auth(USER_ROLE.manager),
    shiftController.getWorkersAttendanceList
);

router.get(
    '/roster',
    auth(USER_ROLE.manager),
    shiftController.getShiftRoster
);

router.get(
    '/today-live-shift-meta',
    auth(USER_ROLE.manager),
    shiftController.getTodayLiveShiftMeta
);

router.get(
    '/report',
    auth(USER_ROLE.manager),
    shiftController.getManagerReport
);

router.get(
    '/today-live-shifts',
    auth(USER_ROLE.manager),
    shiftController.getTodayLiveShifts
);

router.get(
    '/photo-review',
    auth(USER_ROLE.manager),
    shiftController.getPhotoReviewList
);

router.get(
    '/single-live-shift/:id',
    auth(USER_ROLE.manager),
    shiftController.getSingleLiveShift
);

router.get('/:planId', auth(USER_ROLE.manager), shiftController.listShifts);

router.get(
    '/:planId/:date',
    auth(USER_ROLE.manager, USER_ROLE.worker),
    shiftController.getShift
);

router.patch(
    '/:planId/:date/assign-workers',
    auth(USER_ROLE.manager),
    validateRequest(shiftValidations.assignWorkersValidationSchema),
    shiftController.assignWorkers
);

router.patch(
    '/:planId/:date/status',
    auth(USER_ROLE.manager),
    validateRequest(shiftValidations.updateStatusValidationSchema),
    shiftController.updateStatus
);

router.patch(
    '/:planId/:date/tasks/:taskId/photo',
    auth(USER_ROLE.worker),
    validateRequest(shiftValidations.uploadTaskPhotoValidationSchema),
    shiftController.uploadTaskPhoto
);

router.patch(
    '/:planId/:date/tasks/:taskId/complete',
    auth(USER_ROLE.worker),
    shiftController.markTaskComplete
);

router.patch(
    '/:planId/:date/check-in',
    auth(USER_ROLE.worker),
    validateRequest(shiftValidations.checkInOutValidationSchema),
    shiftController.checkIn
);

router.patch(
    '/:planId/:date/check-out',
    auth(USER_ROLE.worker),
    validateRequest(shiftValidations.checkInOutValidationSchema),
    shiftController.checkOut
);

export const shiftRoutes = router;
