import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { AdditionalTask } from './additional_task.model';

const PLAN_BRIEF = { path: 'cleaning_plan_id', select: 'title client location' };

const getAllAdditionalTasksForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const taskQuery = new QueryBuilder(
        AdditionalTask.find({ manager: { $in: managerIds } })
            .populate(PLAN_BRIEF)
            .populate(MANAGER_BRIEF),
        withSafeSearch(query)
    )
        .search(['name', 'description'])
        .filter()
        .paginate()
        .sort();

    const meta = await taskQuery.countTotal();
    const result = await taskQuery.modelQuery;
    return { meta, result };
};

const getSingleAdditionalTaskForCompany = async (
    companyId: string,
    id: string
) => {
    assertValidId(id, 'additional task');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const task = await AdditionalTask.findOne({
        _id: id,
        manager: { $in: managerIds },
    })
        .populate(PLAN_BRIEF)
        .populate(MANAGER_BRIEF);
    if (!task)
        throw new AppError(httpStatus.NOT_FOUND, 'Additional task not found');
    return task;
};

export default {
    getAllAdditionalTasksForCompany,
    getSingleAdditionalTaskForCompany,
};
