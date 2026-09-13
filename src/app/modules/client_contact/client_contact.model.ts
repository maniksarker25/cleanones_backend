import { Schema, model } from 'mongoose';
import { IClientContact } from './client_contact.interface';

const clientContactSchema = new Schema<IClientContact>(
    {
        client: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        role: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps:true,
        versionKey: false,
    }
);

export const ClientContact = model<IClientContact>(
    'ClientContact',
    clientContactSchema,
    'client_contacts'
);
