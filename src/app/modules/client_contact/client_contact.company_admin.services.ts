import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { ClientContact } from './client_contact.model';

const CLIENT_BRIEF = { path: 'client', select: 'name company_name' };

const getAllClientContactsForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const contactQuery = new QueryBuilder(
        ClientContact.find({ manager: { $in: managerIds } })
            .populate(CLIENT_BRIEF)
            .populate(MANAGER_BRIEF),
        withSafeSearch(query)
    )
        .search(['name', 'role', 'phone', 'email'])
        .filter()
        .paginate()
        .sort();

    const meta = await contactQuery.countTotal();
    const result = await contactQuery.modelQuery;
    return { meta, result };
};

const getSingleClientContactForCompany = async (
    companyId: string,
    id: string
) => {
    assertValidId(id, 'client contact');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const contact = await ClientContact.findOne({
        _id: id,
        manager: { $in: managerIds },
    })
        .populate(CLIENT_BRIEF)
        .populate(MANAGER_BRIEF);
    if (!contact)
        throw new AppError(httpStatus.NOT_FOUND, 'Client contact not found');
    return contact;
};

export default {
    getAllClientContactsForCompany,
    getSingleClientContactForCompany,
};
