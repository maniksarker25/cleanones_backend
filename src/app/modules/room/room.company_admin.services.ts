import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import {
    assertValidId,
    MANAGER_BRIEF,
    resolveCompanyManagerIds,
    withSafeSearch,
} from '../company/company.scope';
import { Room } from './room.model';

const LOCATION_BRIEF = { path: 'location', select: 'name address client' };

const getAllRoomsForCompany = async (
    companyId: string,
    query: Record<string, unknown>
) => {
    const managerIds = await resolveCompanyManagerIds(companyId, query.manager);

    const roomQuery = new QueryBuilder(
        Room.find({ is_active: true, manager: { $in: managerIds } })
            .populate(LOCATION_BRIEF)
            .populate(MANAGER_BRIEF),
        withSafeSearch(query)
    )
        .search(['name', 'room_type', 'cleaning_type'])
        .filter()
        .paginate()
        .sort();

    const meta = await roomQuery.countTotal();
    const result = await roomQuery.modelQuery;
    return { meta, result };
};

const getSingleRoomForCompany = async (companyId: string, id: string) => {
    assertValidId(id, 'room');
    const managerIds = await resolveCompanyManagerIds(companyId);

    const room = await Room.findOne({ _id: id, manager: { $in: managerIds } })
        .populate(LOCATION_BRIEF)
        .populate(MANAGER_BRIEF);
    if (!room) throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
    return room;
};

export default { getAllRoomsForCompany, getSingleRoomForCompany };
