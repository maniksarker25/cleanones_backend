import { Router } from 'express';
import { AdminRoutes } from '../modules/admin/admin.routes';
import { additionalTaskRoutes } from '../modules/additional_task/additional_task.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { clientRoutes } from '../modules/client/client.routes';
import { clientContactRoutes } from '../modules/client_contact/client_contact.routes';
import { cleaningPlanRoutes } from '../modules/cleaning_plan/cleaning_plan.routes';
import { fileUploadRoutes } from '../modules/file-upload/file-upload.routes';
import { legalInfoRoutes } from '../modules/legal_info/legal_info.routes';
import { locationRoutes } from '../modules/location/location.routes';
import { ManageRoutes } from '../modules/manage-web/manage.routes';
import { metaRoutes } from '../modules/meta/meta.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
import { roomRoutes } from '../modules/room/room.routes';
import { shiftRoutes } from '../modules/shift/shift.routes';
import { superAdminRoutes } from '../modules/superAdmin/superAdmin.routes';
import { taskRoutes } from '../modules/task/task.routes';
import { userRoutes } from '../modules/user/user.routes';
import { workerRoutes } from '../modules/worker/worker.routes';

const router = Router();

const moduleRoutes = [
    {
        path: '/client-contact',
        router: clientContactRoutes,
    },
    {
        path: '/worker',
        router: workerRoutes,
    },
    {
        path: '/auth',
        router: authRoutes,
    },
    {
        path: '/user',
        router: userRoutes,
    },
    {
        path: '/client',
        router: clientRoutes,
    },
    {
        path: '/location',
        router: locationRoutes,
    },
    {
        path: '/room',
        router: roomRoutes,
    },
    {
        path: '/task',
        router: taskRoutes,
    },
    {
        path: '/cleaning-plan',
        router: cleaningPlanRoutes,
    },
    {
        path: '/additional-task',
        router: additionalTaskRoutes,
    },
    {
        path: '/shift',
        router: shiftRoutes,
    },

    {
        path: '/manage',
        router: ManageRoutes,
    },
    {
        path: '/notification',
        router: notificationRoutes,
    },

    {
        path: '/super-admin',
        router: superAdminRoutes,
    },

    {
        path: '/meta',
        router: metaRoutes,
    },
    {
        path: '/file',
        router: fileUploadRoutes,
    },
    {
        path: '/admin',
        router: AdminRoutes,
    },
    {
        path: '/legal-info',
        router: legalInfoRoutes,
    },
];

moduleRoutes.forEach((route) => router.use(route.path, route.router));

export default router;
