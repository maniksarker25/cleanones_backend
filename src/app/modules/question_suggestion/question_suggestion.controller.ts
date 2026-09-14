import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import services from './question_suggestion.services';

const create = catchAsync(async (req, res) => {
    const result = await services.create(req.body);
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Question suggestion created successfully',
        data: result,
    });
});

const update = catchAsync(async (req, res) => {
    const result = await services.update(req.params.id, req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Question suggestion updated successfully',
        data: result,
    });
});

const remove = catchAsync(async (req, res) => {
    const result = await services.remove(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Question suggestion deleted successfully',
        data: result,
    });
});

const getAll = catchAsync(async (req, res) => {
    const result = await services.getAll();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Question suggestions retrieved successfully',
        data: result,
    });
});

export default { create, update, remove, getAll };
