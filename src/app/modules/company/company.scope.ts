import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { Manager } from '../manager/manager.model';

export const resolveCompanyManagerIds = async (
    companyId: string,
    requestedManager?: unknown
): Promise<Types.ObjectId[]> => {
    const managerIds = await Manager.find({ company: companyId }).distinct('_id');

    if (requestedManager === undefined || requestedManager === '') {
        return managerIds;
    }
    if (
        typeof requestedManager !== 'string' ||
        !mongoose.isObjectIdOrHexString(requestedManager) ||
        !managerIds.some((id) => id.toString() === requestedManager)
    ) {
        throw new AppError(httpStatus.NOT_FOUND, 'Manager not found');
    }
    return [new Types.ObjectId(requestedManager)];
};

export const assertValidId = (id: string, label: string): void => {
    if (!mongoose.isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${label} ID`);
    }
};

export const MANAGER_BRIEF = { path: 'manager', select: 'name email phone' };

export const withSafeSearch = (
    query: Record<string, unknown>
): Record<string, unknown> =>
    typeof query.searchTerm === 'string'
        ? {
              ...query,
              searchTerm: query.searchTerm.replace(
                  /[.*+?^${}()|[\]\\]/g,
                  '\\$&'
              ),
          }
        : query;
