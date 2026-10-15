import httpStatus from 'http-status';
import { isObjectIdOrHexString } from 'mongoose';
import AppError from '../../error/appError';
import { managerScope } from '../../utilities/managerScope';
import { Client } from '../client/client.model';
import { IClientContact } from './client_contact.interface';
import { ClientContact } from './client_contact.model';

const validateId = (id: string) => {
    if (!isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid client contact ID');
    }
};

const ensureClientExists = async (
    managerId: string,
    clientId: IClientContact['client']
) => {
    if (!isObjectIdOrHexString(clientId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid client ID');
    }
    const client = await Client.findOne({
        _id: clientId,
        isDeleted: false,
        ...managerScope(managerId),
    });
    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }
};

const createClientContactIntoDB = async (
    managerId: string,
    payload: Omit<IClientContact, 'manager'>
) => {
    const { client, name, role, phone, email } = payload;
    await ensureClientExists(managerId, client);
    return ClientContact.create({
        manager: managerId,
        client,
        name,
        role,
        phone,
        email,
    });
};

const updateClientContactIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<IClientContact>
) => {
    validateId(id);
    const updates: Partial<IClientContact> = {};
    if (payload.client !== undefined) {
        await ensureClientExists(managerId, payload.client);
        updates.client = payload.client;
    }
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.role !== undefined) updates.role = payload.role;
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.email !== undefined) updates.email = payload.email;
    const result = await ClientContact.findOneAndUpdate(
        { _id: id, ...managerScope(managerId) },
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

const deleteClientContactFromDB = async (managerId: string, id: string) => {
    validateId(id);
    const result = await ClientContact.findOneAndDelete({
        _id: id,
        ...managerScope(managerId),
    });
    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client contact not found');
    }
    return result;
};

const getAllClientContactsFromDB = async (managerId: string) => {
    return ClientContact.find(managerScope(managerId)).sort('-createdAt');
};

const getSingleClientContactFromDB = async (managerId: string, id: string) => {
    validateId(id);
    const result = await ClientContact.findOne({
        _id: id,
        ...managerScope(managerId),
    });
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
