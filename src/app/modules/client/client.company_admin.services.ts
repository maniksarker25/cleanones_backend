import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { Client } from './client.model';

const getAllClientsForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const clientQuery = new QueryBuilder(
        Client.find({ isDeleted: false, manager: { $in: managerIds } }).populate(
            MANAGER_BRIEF
        ),
        withSafeSearch(query)
    )
        .search(['name', 'email', 'phone', 'company_name'])
        .filter()
        .paginate()
        .sort();

    const meta = await clientQuery.countTotal();
    const result = await clientQuery.modelQuery;
    return { meta, result };
};

const getSingleClientForCompany = async (companyId: string, id: string) => {
    assertValidId(id, 'client');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const client = await Client.findOne({
        _id: id,
        isDeleted: false,
        manager: { $in: managerIds },
    }).populate(MANAGER_BRIEF);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    return client;
};

export default { getAllClientsForCompany, getSingleClientForCompany };
