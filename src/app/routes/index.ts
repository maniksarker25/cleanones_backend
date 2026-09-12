import { Router } from 'express';
import { AdminRoutes } from '../modules/admin/admin.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { fileUploadRoutes } from '../modules/file-upload/file-upload.routes';
import { legalInfoRoutes } from '../modules/legal_info/legal_info.routes';
import { ManageRoutes } from '../modules/manage-web/manage.routes';
import { metaRoutes } from '../modules/meta/meta.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
import { superAdminRoutes } from '../modules/superAdmin/superAdmin.routes';
import { userRoutes } from '../modules/user/user.routes';

const router = Router();

const moduleRoutes = [
    {
        path: '/auth',
        router: authRoutes,
    },
    {
        path: '/user',
        router: userRoutes,
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
