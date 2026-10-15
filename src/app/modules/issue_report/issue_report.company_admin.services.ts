import QueryBuilder from '../../builder/QueryBuilder';
import {
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { IssueReport } from './issue_report.model';

const getAllIssueReportsForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const issueQuery = new QueryBuilder(
        IssueReport.find({ manager: { $in: managerIds } })
            .populate(MANAGER_BRIEF)
            .populate('worker', 'name email phone')
            .populate('location', 'name address'),
        withSafeSearch(query)
    )
        .search(['issueType', 'description'])
        .filter()
        .paginate()
        .sort();

    const meta = await issueQuery.countTotal();
    const result = await issueQuery.modelQuery;
    return { meta, result };
};

export default { getAllIssueReportsForCompany };
