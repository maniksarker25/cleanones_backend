import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import invoiceServices from './invoice.services';

const createInvoice = catchAsync(async (req, res) => {
    const result = await invoiceServices.createInvoiceIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Invoice created successfully',
        data: result,
    });
});

const getAllInvoices = catchAsync(async (req, res) => {
    const result = await invoiceServices.getAllInvoicesFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Invoices retrieved successfully',
        data: result,
    });
});

const getMyInvoices = catchAsync(async (req, res) => {
    const result = await invoiceServices.getMyInvoicesFromDB(
        req.user.profileId as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'My invoices retrieved successfully',
        data: result,
    });
});

const invoiceController = {
    createInvoice,
    getAllInvoices,
    getMyInvoices,
};

export default invoiceController;
