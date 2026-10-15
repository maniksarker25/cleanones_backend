import { Schema, model } from 'mongoose';
import { TRoom } from './room.interface';


const roomSchema = new Schema<TRoom>(
    {
        manager: { type: Schema.Types.ObjectId, ref: 'Manager', required: true, index: true },
        location: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
        last_updated_by: { type: Schema.Types.ObjectId, ref: 'Manager', default: null },
        name: { type: String, required: true },
        room_type: { type: String, required: true },
        cleaning_type: { type: String, required: true },
        floor: { type: Number, default: null },
        is_active: { type: Boolean, default: true },
    },
    {
        timestamps:true,
        versionKey: false,
    }
);

roomSchema.index({ name: 1 });
roomSchema.index({ manager: 1, location: 1, is_active: 1 });

export const Room = model<TRoom>('Room', roomSchema);
