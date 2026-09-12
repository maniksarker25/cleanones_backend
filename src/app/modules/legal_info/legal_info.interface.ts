import { Schema } from 'mongoose';

export interface ILegalInfo {
    venueOwner: Schema.Types.ObjectId;
    companyName: string;
    businessType: string;
    registeredAddress: string;
    contactEmail: string;
    contactPhone: string;
    jurisdiction: string;
    officialWebsite: string;
    platformFeePercentage: number;
    freeCancellationHour: number;
}
