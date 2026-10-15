import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { CleaningPlan } from './cleaning_plan.model';

const CLIENT_BRIEF = { path: 'client', select: 'name email phone company_name' };
const LOCATION_BRIEF = { path: 'location', select: 'name address' };

const getAllCleaningPlansForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const planQuery = new QueryBuilder(
        CleaningPlan.find({ is_active: true, manager: { $in: managerIds } })
            .populate(CLIENT_BRIEF)
            .populate(LOCATION_BRIEF)
            .populate(MANAGER_BRIEF),
        withSafeSearch(query)
    )
        .search(['title', 'description'])
        .filter()
        .paginate()
        .sort();

    const meta = await planQuery.countTotal();
    const result = await planQuery.modelQuery;
    return { meta, result };
};

const getSingleCleaningPlanForCompany = async (
    companyId: string,
    id: string
) => {
    assertValidId(id, 'cleaning plan');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const plan = await CleaningPlan.findOne({
        _id: id,
        manager: { $in: managerIds },
    })
        .populate(CLIENT_BRIEF)
        .populate(LOCATION_BRIEF)
        .populate({ path: 'rooms', select: 'name room_type cleaning_type floor' })
        .populate({ path: 'tasks', select: 'name frequency_type duration_minutes' })
        .populate(MANAGER_BRIEF);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

export default {
    getAllCleaningPlansForCompany,
    getSingleCleaningPlanForCompany,
};
