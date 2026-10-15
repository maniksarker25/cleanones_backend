import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { Worker } from './worker.model';

const activeWorker = { isDeleted: { $ne: true } };

const getAllWorkersForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const workerQuery = new QueryBuilder(
        Worker.find({ ...activeWorker, manager: { $in: managerIds } }).populate(
            'manager',
            'name email phone'
        ),
        withSafeSearch(query)
    )
        .search(['name', 'email', 'phone', 'position', 'nationality'])
        .filter()
        .paginate()
        .sort();

    const meta = await workerQuery.countTotal();
    const result = await workerQuery.modelQuery;
    return { meta, result };
};

const getSingleWorkerForCompany = async (companyId: string, id: string) => {
    assertValidId(id, 'worker');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const worker = await Worker.findOne({
        _id: id,
        ...activeWorker,
        manager: { $in: managerIds },
    }).populate(MANAGER_BRIEF);
    if (!worker) throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    return worker;
};

export default { getAllWorkersForCompany, getSingleWorkerForCompany };
