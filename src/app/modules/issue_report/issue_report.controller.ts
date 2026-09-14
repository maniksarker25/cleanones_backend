import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import services from './issue_report.services';

const createIssueReport = catchAsync(async (req, res) => {
    const result = await services.createIssueReportIntoDB(req.body, req.user.profileId as string);
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Issue report created successfully',
        data: result,
    });
});

const updateIssueReport = catchAsync(async (req, res) => {
    const result = await services.updateIssueReportIntoDB(
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Issue report updated successfully',
        data: result,
    });
});

const deleteIssueReport = catchAsync(async (req, res) => {
    const result = await services.deleteIssueReportFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Issue report deleted successfully',
        data: result,
    });
});

const getAllIssueReports = catchAsync(async (req, res) => {
    const result = await services.getAllIssueReportsFromDB();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Issue reports retrieved successfully',
        data: result,
    });
});

const getMyIssueReports = catchAsync(async (req, res) => {
    const result = await services.getMyIssueReportsFromDB(req.user.profileId as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'My issue reports retrieved successfully',
        data: result,
    });
});

export default {
    getMyIssueReports,
    createIssueReport,
    updateIssueReport,
    deleteIssueReport,
    getAllIssueReports,
};
