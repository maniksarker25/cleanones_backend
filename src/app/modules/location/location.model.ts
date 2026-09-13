import { Schema, model } from 'mongoose';
import { LOCATION_TYPE, TLocation } from './location.interface';

const locationSchema = new Schema<TLocation>(
    {
        client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        last_updated_by: { type: Schema.Types.ObjectId, ref: 'Manager', default: null },
        name: { type: String, required: true },
        address: { type: String, required: true },
        description: { type: String, default: null },
        type: { type: String, enum: LOCATION_TYPE, required: true },
        is_active: { type: Boolean, default: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: undefined },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

locationSchema.index({ client: 1, is_active: 1 });
locationSchema.index({ location: '2dsphere' }, { sparse: true });

export const Location = model<TLocation>('Location',locationSchema);
