/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { PipelineStage } from 'mongoose';
import Conversation from './conversation.model';

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

const getConversation = async (
    profileId: string,
    query: Record<string, unknown>
) => {
    if (!mongoose.isValidObjectId(profileId)) {
        throw new Error('Invalid profileId');
    }

    const profileObjectId = new mongoose.Types.ObjectId(profileId);

    const page = getPositiveNumber(query.page, 1);
    const limit = getPositiveNumber(query.limit, 10, 50);
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
        {
            $match: {
                participants: profileObjectId,
            },
        },

        // Prefer lastMessageAt if you added it.
        // updatedAt is kept as fallback / tie-breaker.
        {
            $sort: {
                lastMessageAt: -1,
                updatedAt: -1,
            },
        },

        {
            $facet: {
                meta: [
                    {
                        $count: 'total',
                    },
                ],

                data: [
                    {
                        $skip: skip,
                    },
                    {
                        $limit: limit,
                    },

                    // Pair participants with their model:
                    // [
                    //   { id: customerId, model: 'Customer' },
                    //   { id: providerId, model: 'Provider' }
                    // ]
                    {
                        $addFields: {
                            participantsPaired: {
                                $map: {
                                    input: {
                                        $range: [0, { $size: '$participants' }],
                                    },
                                    as: 'i',
                                    in: {
                                        id: {
                                            $arrayElemAt: [
                                                '$participants',
                                                '$$i',
                                            ],
                                        },
                                        model: {
                                            $arrayElemAt: [
                                                '$participantsModel',
                                                '$$i',
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },

                    // Find the other participant
                    {
                        $addFields: {
                            other: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: '$participantsPaired',
                                            as: 'participant',
                                            cond: {
                                                $ne: [
                                                    '$$participant.id',
                                                    profileObjectId,
                                                ],
                                            },
                                        },
                                    },
                                    0,
                                ],
                            },
                        },
                    },

                    // Lookup customer only when other.model === Customer
                    {
                        $lookup: {
                            from: 'customers',
                            let: {
                                otherId: '$other.id',
                                otherModel: '$other.model',
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                {
                                                    $eq: ['$_id', '$$otherId'],
                                                },
                                                {
                                                    $eq: [
                                                        '$$otherModel',
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
                            as: 'customerData',
                        },
                    },

                    // Lookup provider only when other.model === Provider
                    {
                        $lookup: {
                            from: 'providers',
                            let: {
                                otherId: '$other.id',
                                otherModel: '$other.model',
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                {
                                                    $eq: ['$_id', '$$otherId'],
                                                },
                                                {
                                                    $eq: [
                                                        '$$otherModel',
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
                            as: 'providerData',
                        },
                    },

                    {
                        $addFields: {
                            userData: {
                                $ifNull: [
                                    {
                                        $arrayElemAt: ['$customerData', 0],
                                    },
                                    {
                                        $arrayElemAt: ['$providerData', 0],
                                    },
                                ],
                            },
                        },
                    },

                    // Count unseen messages for current user.
                    // This uses receiverId, which is faster and cleaner than msgByUserId: { $ne: profileId }
                    {
                        $lookup: {
                            from: 'messages',
                            let: {
                                conversationId: '$_id',
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        '$conversationId',
                                                        '$$conversationId',
                                                    ],
                                                },
                                                {
                                                    $eq: [
                                                        '$receiverId',
                                                        profileObjectId,
                                                    ],
                                                },
                                                {
                                                    $eq: ['$seen', false],
                                                },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $count: 'count',
                                },
                            ],
                            as: 'unseenCountData',
                        },
                    },

                    {
                        $addFields: {
                            unseenMsg: {
                                $ifNull: [
                                    {
                                        $arrayElemAt: [
                                            '$unseenCountData.count',
                                            0,
                                        ],
                                    },
                                    0,
                                ],
                            },
                        },
                    },

                    // Populate last message with only needed fields
                    {
                        $lookup: {
                            from: 'messages',
                            let: {
                                lastMessageId: '$lastMessage',
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$_id', '$$lastMessageId'],
                                        },
                                    },
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        text: 1,
                                        imageUrl: 1,
                                        videoUrl: 1,
                                        pdfUrl: 1,
                                        msgByUserId: 1,
                                        msgByUserModel: 1,
                                        receiverId: 1,
                                        receiverModel: 1,
                                        seen: 1,
                                        createdAt: 1,
                                        updatedAt: 1,
                                    },
                                },
                            ],
                            as: 'lastMessage',
                        },
                    },

                    {
                        $addFields: {
                            lastMessage: {
                                $arrayElemAt: ['$lastMessage', 0],
                            },
                        },
                    },

                    {
                        $project: {
                            _id: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            lastMessageAt: 1,
                            unseenMsg: 1,
                            lastMessage: 1,
                            userData: {
                                _id: '$userData._id',
                                name: '$userData.name',
                                email: '$userData.email',
                                profile_image: '$userData.profile_image',
                            },
                        },
                    },
                ],
            },
        },
    ];

    const [result] = await Conversation.aggregate<{
        meta: { total: number }[];
        data: any[];
    }>(pipeline);

    const total = result?.meta?.[0]?.total || 0;

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        data: result?.data || [],
    };
};

export default { getConversation };
