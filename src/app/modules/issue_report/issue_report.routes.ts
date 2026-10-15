import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import controller from './issue_report.controller';
import issueReportCompanyAdminController from './issue_report.company_admin.controller';
import validations from './issue_report.validation';

const router = Router();
router.get(
    '/get-my-issue-report',
    auth(USER_ROLE.worker),
    controller.getMyIssueReports
);

router.post(
    '/create-issue-report',
    auth(USER_ROLE.worker),
    validateRequest(validations.createIssueReportValidationSchema),
    controller.createIssueReport
);
router.patch(
    '/update-issue-report/:id',
    auth(USER_ROLE.manager),
    validateRequest(validations.updateIssueReportValidationSchema),
    controller.updateIssueReport
);
router.delete(
    '/delete-issue-report/:id',
    auth(USER_ROLE.manager),
    controller.deleteIssueReport
);
router.get(
    '/all-issue-reports',
    auth(USER_ROLE.manager),
    controller.getAllIssueReports
);

router.get(
    '/company-admin/get-all-issue-reports',
    auth(USER_ROLE.company_admin),
    issueReportCompanyAdminController.getAllIssueReports
);

export const issueReportRoutes = router;
