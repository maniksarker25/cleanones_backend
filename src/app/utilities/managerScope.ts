import httpStatus from 'http-status';
import { FilterQuery, Model, Types } from 'mongoose';
import AppError from '../error/appError';

type Id = string | Types.ObjectId;

/**
 * Casts a manager profile id to an ObjectId. Needed for aggregate pipelines,
 * where (unlike find/update) Mongoose does not cast strings for us.
 */
export const toManagerObjectId = (managerId: Id): Types.ObjectId => {
    if (!Types.ObjectId.isValid(managerId.toString())) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid manager session');
    }
    return new Types.ObjectId(managerId.toString());
};

/** `{ manager }` filter fragment — spread it LAST so caller input can't override it. */
export const managerScope = (managerId: Id) => ({
    manager: toManagerObjectId(managerId),
});

/**
 * Verifies every id exists AND belongs to the manager, in a single indexed
 * count. Missing and foreign ids are reported identically (404) so one
 * manager can't probe for the existence of another's records.
 */
export const assertOwned = async <T>(
    model: Model<T>,
    ids: Id | Id[],
    managerId: Id,
    label: string,
    extraFilter: FilterQuery<T> = {}
): Promise<void> => {
    const unique = [...new Set([ids].flat().map((id) => id.toString()))];
    if (!unique.length) return;
    if (!unique.every((id) => Types.ObjectId.isValid(id))) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${label} ID`);
    }
    const count = await model.countDocuments({
        ...extraFilter,
        _id: { $in: unique },
        manager: toManagerObjectId(managerId),
    } as FilterQuery<T>);
    if (count !== unique.length) {
        throw new AppError(httpStatus.NOT_FOUND, `${label} not found`);
    }
};
