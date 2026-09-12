import { Schema, model } from 'mongoose';

const deviceSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        playerId: {
            type: String,
            required: true,
            unique: true, // important
        },

        platform: {
            type: String,
            enum: ['ios', 'android', 'web'],
            required: true,
        },

        deviceName: String,
        appVersion: String,

        isActive: {
            type: Boolean,
            default: true,
        },

        lastActiveAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

deviceSchema.index({ userId: 1, playerId: 1 }, { unique: true });

export const Device = model('Device', deviceSchema);
