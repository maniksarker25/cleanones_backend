import { Schema, model } from 'mongoose';
import { ENUM_SUPPORT_STATUS } from './support.enum';

const supportSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'userModel',
        },
        userModel: {
            type: String,
            required: true,
            enum: ['Customer', 'Provider'],
        },
        contactReason: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(ENUM_SUPPORT_STATUS),
            default: ENUM_SUPPORT_STATUS.TODO,
        },
    },
    {
        timestamps: true,
    }
);

export const Support = model('Support', supportSchema);
