import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import invoiceCompanyAdminServices from './invoice.company_admin.services';

const getAllInvoices = catchAsync(async (req, res) => {
    const result = await invoiceCompanyAdminServices.getAllInvoicesForCompany(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Invoices retrieved successfully',
        data: result,
    });
});

export default { getAllInvoices };
