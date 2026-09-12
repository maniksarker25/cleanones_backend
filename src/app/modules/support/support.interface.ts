import { Types } from 'mongoose';
import { ENUM_SUPPORT_STATUS } from './support.enum';

export type TUserModel = 'Customer' | 'Bartender' | 'VenueOwner';

export interface ISupport {
  user: Types.ObjectId;
  userModel: TUserModel;
  contactReason: string;
  message: string;
  status: (typeof ENUM_SUPPORT_STATUS)[keyof typeof ENUM_SUPPORT_STATUS];
  createdAt?: Date;
  updatedAt?: Date;
}
