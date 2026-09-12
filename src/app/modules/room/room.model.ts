import { Schema, model } from 'mongoose';
import { TRequiredPhoto, TRoom } from './room.interface';

const requiredPhotoSchema = new Schema<TRequiredPhoto>(
    {
        name: { type: String, required: true },
        frequency_type: { type: String, enum: ['daily', 'weekly', 'monthly', null], default: null },
    },
    { _id: false }
);

const roomSchema = new Schema<TRoom>(
    {
        location: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
        name: { type: String, required: true },
        room_type: { type: String, required: true },
        floor: { type: Number, default: null },
        duration_minutes: { type: Number, default: null },
        monthly_cleaning_frequency: { type: Number, default: null },
        required_photos: { type: [requiredPhotoSchema], default: [] },
        is_active: { type: Boolean, default: true },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

roomSchema.index({ location: 1, is_active: 1 });
roomSchema.index({ name: 1 });

export const Room = model<TRoom>('Room', roomSchema, 'rooms');
