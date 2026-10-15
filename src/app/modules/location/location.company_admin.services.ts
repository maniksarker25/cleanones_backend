import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { Location } from './location.model';

const CLIENT_BRIEF = { path: 'client', select: 'name email phone company_name' };

const getAllLocationsForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const locationQuery = new QueryBuilder(
        Location.find({ is_active: true, manager: { $in: managerIds } })
            .populate(CLIENT_BRIEF)
            .populate(MANAGER_BRIEF),
        withSafeSearch(query)
    )
        .search(['name', 'address'])
        .filter()
        .paginate()
        .sort();

    const meta = await locationQuery.countTotal();
    const result = await locationQuery.modelQuery;
    return { meta, result };
};

const getSingleLocationForCompany = async (companyId: string, id: string) => {
    assertValidId(id, 'location');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const location = await Location.findOne({
        _id: id,
        manager: { $in: managerIds },
    })
        .populate(CLIENT_BRIEF)
        .populate(MANAGER_BRIEF);
    if (!location)
        throw new AppError(httpStatus.NOT_FOUND, 'Location not found');
    return location;
};

export default { getAllLocationsForCompany, getSingleLocationForCompany };
