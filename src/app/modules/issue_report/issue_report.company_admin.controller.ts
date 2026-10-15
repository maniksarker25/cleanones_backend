import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import issueReportCompanyAdminServices from './issue_report.company_admin.services';

const getAllIssueReports = catchAsync(async (req, res) => {
    const result =
        await issueReportCompanyAdminServices.getAllIssueReportsForCompany(
            req.user.profileId as string,
            req.query
        );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Issue reports retrieved successfully',
        data: result,
    });
});

export default { getAllIssueReports };
