import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import chatMessageServices from './chat_message.services';

const getChatMessages = catchAsync(async (req, res) => {
    const result = await chatMessageServices.getChatMessagesFromDB(
        req.params.chatId,
        req.user.profileId as string,
        req.user.role as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Messages retrieved successfully',
        data: result,
    });
});

const deleteChatMessage = catchAsync(async (req, res) => {
    const result = await chatMessageServices.deleteChatMessage(
        req.params.id,
        req.user.id as string,
        req.user.profileId as string,
        req.user.role as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Message deleted successfully',
        data: result,
    });
});

const chatMessageController = {
    getChatMessages,
    deleteChatMessage,
};

export default chatMessageController;
