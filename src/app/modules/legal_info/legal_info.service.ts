/* eslint-disable @typescript-eslint/no-explicit-any */
import { ILegalInfo } from './legal_info.interface';
import { LegalInfo } from './legal_info.model';

const addOrUpdateLegalInfo = async (legalInfoData: ILegalInfo) => {
  const result = await LegalInfo.findOneAndUpdate(
    {},
    { $set: legalInfoData },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  );

  return result;
};

const getLegalInfoByVenueOwnerId = async () => {
  const legalInfo = await LegalInfo.findOne();
  return legalInfo;
};

const LegalInfoService = {
  addOrUpdateLegalInfo,
  getLegalInfoByVenueOwnerId,
};

export default LegalInfoService;
