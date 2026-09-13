import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import ConversationService from './conversation.service';

const getChatList = catchAsync(async (req, res) => {
    const result = await ConversationService.getConversation(
        req?.user?.profileId,
        req?.user?.role,
        req.query
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Conversation retrieved successfully',
        data: result,
    });
});

const ConversationController = {
    getChatList,
};

export default ConversationController;
