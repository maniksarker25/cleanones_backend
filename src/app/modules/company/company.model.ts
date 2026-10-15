import { Schema, model } from 'mongoose';
import { ICompany } from './company.interface';

const companySchema = new Schema<ICompany>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, required: true, trim: true },
        company_name: { type: String, required: true, trim: true },
        address: { type: String, default: null },
        website: { type: String, default: null },
        profile_image: { type: String, default: null },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const Company = model<ICompany>('Company', companySchema, 'companies');
