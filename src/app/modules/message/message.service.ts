/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { PipelineStage } from 'mongoose';
import Conversation from '../conversation/conversation.model';
import Message from './message.model';

const getPositiveNumber = (
    value: unknown,
    defaultValue: number,
    max?: number
) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        return defaultValue;
    }

    return max ? Math.min(parsed, max) : parsed;
};

const escapeRegex = (value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getMessagesByConversationId = async (
    profileId: string,
    conversationId: string,
    query: Record<string, unknown>
) => {
    if (
        !mongoose.isValidObjectId(profileId) ||
        !mongoose.isValidObjectId(conversationId)
    ) {
        throw new Error('Invalid id');
    }

    const profileObjectId = new mongoose.Types.ObjectId(profileId);
    const conversationObjectId = new mongoose.Types.ObjectId(conversationId);

    const page = getPositiveNumber(query.page, 1);
    const limit = getPositiveNumber(query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const searchTerm = ((query.searchTerm as string) || '').trim();

    const conversation = await Conversation.findOne({
        _id: conversationObjectId,
        participants: profileObjectId,
    })
        .select('_id')
        .lean();

    if (!conversation) {
        return {
            meta: {
                page,
                limit,
                total: 0,
                totalPages: 0,
            },
            result: [],
        };
    }

    const matchStage: PipelineStage.Match['$match'] = {
        conversationId: conversationObjectId,
    };

    if (searchTerm) {
        matchStage.text = {
            $regex: escapeRegex(searchTerm),
            $options: 'i',
        };
    }

    const pipeline: PipelineStage[] = [
        {
            $match: matchStage,
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $facet: {
                totalCount: [
                    {
                        $count: 'total',
                    },
                ],
                result: [
                    {
                        $skip: skip,
                    },
                    {
                        $limit: limit,
                    },
                    {
                        $lookup: {
                            from: 'customers',
                            let: {
                                senderId: '$msgByUserId',
                                senderModel: '$msgByUserModel',
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$_id', '$$senderId'] },
                                                {
                                                    $eq: [
                                                        '$$senderModel',
                                                        'Customer',
                                                    ],
                                                },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        name: 1,
                                        email: 1,
                                        profile_image: 1,
                                    },
                                },
                            ],
                            as: 'customerDetails',
                        },
                    },
                    {
                        $lookup: {
                            from: 'providers',
                            let: {
                                senderId: '$msgByUserId',
                                senderModel: '$msgByUserModel',
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$_id', '$$senderId'] },
                                                {
                                                    $eq: [
                                                        '$$senderModel',
                                                        'Provider',
                                                    ],
                                                },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        name: 1,
                                        email: 1,
                                        profile_image: 1,
                                    },
                                },
                            ],
                            as: 'providerDetails',
                        },
                    },
                    {
                        $addFields: {
                            userDetails: {
                                $ifNull: [
                                    { $arrayElemAt: ['$customerDetails', 0] },
                                    { $arrayElemAt: ['$providerDetails', 0] },
                                ],
                            },
                            isMyMessage: {
                                $eq: ['$msgByUserId', profileObjectId],
                            },
                        },
                    },
                    {
                        $project: {
                            text: 1,
                            imageUrl: 1,
                            videoUrl: 1,
                            pdfUrl: 1,
                            seen: 1,
                            msgByUserId: 1,
                            msgByUserModel: 1,
                            receiverId: 1,
                            receiverModel: 1,
                            conversationId: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            isMyMessage: 1,
                            userDetails: {
                                _id: '$userDetails._id',
                                name: '$userDetails.name',
                                email: '$userDetails.email',
                                profile_image: '$userDetails.profile_image',
                            },
                        },
                    },
                ],
            },
        },
    ];

    const [messages] = await Message.aggregate<{
        totalCount: { total: number }[];
        result: any[];
    }>(pipeline);

    const result = messages?.result || [];
    const total = messages?.totalCount?.[0]?.total || 0;

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        result,
    };
};

const MessageService = {
    getMessagesByConversationId,
};

export default MessageService;
