import { Schema, model } from 'mongoose';
import { TLocation } from './location.interface';

const locationSchema = new Schema<TLocation>(
    {
        client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        name: { type: String, required: true },
        address: { type: String, required: true },
        is_active: { type: Boolean, default: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: undefined },
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

locationSchema.index({ client: 1, is_active: 1 });
locationSchema.index({ location: '2dsphere' }, { sparse: true });

export const Location = model<TLocation>('Location',locationSchema);
