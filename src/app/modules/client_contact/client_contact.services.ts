import httpStatus from 'http-status';
import { isObjectIdOrHexString } from 'mongoose';
import AppError from '../../error/appError';
import { Client } from '../client/client.model';
import { IClientContact } from './client_contact.interface';
import { ClientContact } from './client_contact.model';

const validateId = (id: string) => {
    if (!isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid client contact ID');
    }
};

const ensureClientExists = async (clientId: IClientContact['client']) => {
    if (!isObjectIdOrHexString(clientId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid client ID');
    }
    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }
};

const createClientContactIntoDB = async (payload: IClientContact) => {
    const { client, name, role, phone, email } = payload;
    await ensureClientExists(client);
    return ClientContact.create({ client, name, role, phone, email });
};

const updateClientContactIntoDB = async (
    id: string,
    payload: Partial<IClientContact>
) => {
    validateId(id);
    const updates: Partial<IClientContact> = {};
    if (payload.client !== undefined) {
        await ensureClientExists(payload.client);
        updates.client = payload.client;
    }
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.role !== undefined) updates.role = payload.role;
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.email !== undefined) updates.email = payload.email;
    const result = await ClientContact.findByIdAndUpdate(
        id,
        { $set: updates },
        {
            new: true,
            runValidators: true,
        }
    );
    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client contact not found');
    }
    return result;
};

const deleteClientContactFromDB = async (id: string) => {
    validateId(id);
    const result = await ClientContact.findByIdAndDelete(id);
    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client contact not found');
    }
    return result;
};

const getAllClientContactsFromDB = async () => {
    return ClientContact.find().sort('-createdAt');
};

const getSingleClientContactFromDB = async (id: string) => {
    validateId(id);
    const result = await ClientContact.findById(id);
    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client contact not found');
    }
    return result;
};

export default {
    createClientContactIntoDB,
    updateClientContactIntoDB,
    deleteClientContactFromDB,
    getAllClientContactsFromDB,
    getSingleClientContactFromDB,
};
