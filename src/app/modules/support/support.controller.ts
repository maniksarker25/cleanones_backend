import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import SupportService from './support.service';

const createSupport = catchAsync(async (req, res) => {
  const result = await SupportService.createSupport(req.user, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Support ticket created successfully',
    data: result,
  });
});

const getAllSupport = catchAsync(async (req, res) => {
  const result = await SupportService.getAllSupport(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support retrieved successfully',
    data: result,
  });
});
const updateStatus = catchAsync(async (req, res) => {
  const result = await SupportService.updateStatus(
    req.params.id,
    req.body.status,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Support status updated to ${req.body.status}`,
    data: result,
  });
});
const getSingle = catchAsync(async (req, res) => {
  const result = await SupportService.getSingle(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Support retrieved successfully`,
    data: result,
  });
});

const SupportController = {
  createSupport,
  getAllSupport,
  updateStatus,
  getSingle,
};

export default SupportController;
