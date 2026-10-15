import QueryBuilder from '../../builder/QueryBuilder';
import {
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { Invoice } from './invoice.model';

const getAllInvoicesForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const invoiceQuery = new QueryBuilder(
        Invoice.find({ manager: { $in: managerIds } })
            .populate(MANAGER_BRIEF)
            .populate('worker', 'name email phone worker_type hourly_rate'),
        withSafeSearch(query)
    )
        .search(['payment_method', 'transaction_id', 'notes'])
        .filter()
        .paginate()
        .sort();

    const meta = await invoiceQuery.countTotal();
    const result = await invoiceQuery.modelQuery;
    return { meta, result };
};

export default { getAllInvoicesForCompany };
