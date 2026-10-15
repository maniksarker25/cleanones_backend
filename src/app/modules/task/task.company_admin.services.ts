import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { Task } from './task.model';

const CLIENT_BRIEF = { path: 'client', select: 'name company_name' };
const LOCATION_BRIEF = { path: 'location', select: 'name address' };
const ROOM_BRIEF = { path: 'room', select: 'name room_type cleaning_type floor' };

const getAllTasksForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const taskQuery = new QueryBuilder(
        Task.find({ is_active: true, manager: { $in: managerIds } })
            .populate(CLIENT_BRIEF)
            .populate(LOCATION_BRIEF)
            .populate(ROOM_BRIEF)
            .populate(MANAGER_BRIEF),
        withSafeSearch(query)
    )
        .search(['name'])
        .filter()
        .paginate()
        .sort();

    const meta = await taskQuery.countTotal();
    const result = await taskQuery.modelQuery;
    return { meta, result };
};

const getSingleTaskForCompany = async (companyId: string, id: string) => {
    assertValidId(id, 'task');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const task = await Task.findOne({ _id: id, manager: { $in: managerIds } })
        .populate(CLIENT_BRIEF)
        .populate(LOCATION_BRIEF)
        .populate(ROOM_BRIEF)
        .populate(MANAGER_BRIEF);
    if (!task) throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    return task;
};

export default { getAllTasksForCompany, getSingleTaskForCompany };
