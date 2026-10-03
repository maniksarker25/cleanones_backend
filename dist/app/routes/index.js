"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const question_suggestion_routes_1 = require("../modules/question_suggestion/question_suggestion.routes");
const issue_report_routes_1 = require("../modules/issue_report/issue_report.routes");
const admin_routes_1 = require("../modules/admin/admin.routes");
const additional_task_routes_1 = require("../modules/additional_task/additional_task.routes");
const auth_routes_1 = require("../modules/auth/auth.routes");
const client_routes_1 = require("../modules/client/client.routes");
const client_contact_routes_1 = require("../modules/client_contact/client_contact.routes");
const cleaning_plan_routes_1 = require("../modules/cleaning_plan/cleaning_plan.routes");
const chat_routes_1 = require("../modules/chat/chat.routes");
const chat_message_routes_1 = require("../modules/chat_message/chat_message.routes");
const conversation_routes_1 = require("../modules/conversation/conversation.routes");
const file_upload_routes_1 = require("../modules/file-upload/file-upload.routes");
const invoice_routes_1 = require("../modules/invoice/invoice.routes");
const legal_info_routes_1 = require("../modules/legal_info/legal_info.routes");
const location_routes_1 = require("../modules/location/location.routes");
const message_routes_1 = require("../modules/message/message.routes");
const manage_routes_1 = require("../modules/manage-web/manage.routes");
const meta_routes_1 = require("../modules/meta/meta.routes");
const notification_routes_1 = require("../modules/notification/notification.routes");
const room_routes_1 = require("../modules/room/room.routes");
const shift_routes_1 = require("../modules/shift/shift.routes");
const superAdmin_routes_1 = require("../modules/superAdmin/superAdmin.routes");
const task_routes_1 = require("../modules/task/task.routes");
const user_routes_1 = require("../modules/user/user.routes");
const worker_routes_1 = require("../modules/worker/worker.routes");
const router = (0, express_1.Router)();
const moduleRoutes = [
    {
        path: '/question-suggestion',
        router: question_suggestion_routes_1.questionSuggestionRoutes,
    },
    {
        path: '/issue-report',
        router: issue_report_routes_1.issueReportRoutes,
    },
    {
        path: '/client-contact',
        router: client_contact_routes_1.clientContactRoutes,
    },
    {
        path: '/worker',
        router: worker_routes_1.workerRoutes,
    },
    {
        path: '/auth',
        router: auth_routes_1.authRoutes,
    },
    {
        path: '/user',
        router: user_routes_1.userRoutes,
    },
    {
        path: '/client',
        router: client_routes_1.clientRoutes,
    },
    {
        path: '/location',
        router: location_routes_1.locationRoutes,
    },
    {
        path: '/room',
        router: room_routes_1.roomRoutes,
    },
    {
        path: '/task',
        router: task_routes_1.taskRoutes,
    },
    {
        path: '/cleaning-plan',
        router: cleaning_plan_routes_1.cleaningPlanRoutes,
    },
    {
        path: '/additional-task',
        router: additional_task_routes_1.additionalTaskRoutes,
    },
    {
        path: '/chat',
        router: chat_routes_1.chatRoutes,
    },
    {
        path: '/chat-message',
        router: chat_message_routes_1.chatMessageRoutes,
    },
    {
        path: '/conversation',
        router: conversation_routes_1.conversationRoutes,
    },
    {
        path: '/message',
        router: message_routes_1.messageRoutes,
    },
    {
        path: '/shift',
        router: shift_routes_1.shiftRoutes,
    },
    {
        path: '/manage',
        router: manage_routes_1.ManageRoutes,
    },
    {
        path: '/notification',
        router: notification_routes_1.notificationRoutes,
    },
    {
        path: '/super-admin',
        router: superAdmin_routes_1.superAdminRoutes,
    },
    {
        path: '/meta',
        router: meta_routes_1.metaRoutes,
    },
    {
        path: '/file',
        router: file_upload_routes_1.fileUploadRoutes,
    },
    {
        path: '/admin',
        router: admin_routes_1.AdminRoutes,
    },
    {
        path: '/legal-info',
        router: legal_info_routes_1.legalInfoRoutes,
    },
    {
        path: '/invoice',
        router: invoice_routes_1.invoiceRoutes,
    },
];
moduleRoutes.forEach((route) => router.use(route.path, route.router));
exports.default = router;
