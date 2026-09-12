import { Schema, model } from 'mongoose';
import { IAdmin } from './admin.interface';

const adminSchema = new Schema<IAdmin>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        phone: {
            type: String,
            default: '',
        },
        profile_image: {
            type: String,
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        address: {
            type: String,
            default: null,
        },
        website: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Admin = model<IAdmin>('Admin', adminSchema);

export default Admin;
