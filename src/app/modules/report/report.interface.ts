import { Types } from 'mongoose';
import { ENUM_REPORT_ROLE } from './report.enum';

export interface IReport {
    reportBy: Types.ObjectId;
    reportByRole: ENUM_REPORT_ROLE;

    reportTo: Types.ObjectId;
    reportToRole: ENUM_REPORT_ROLE;

    task: Types.ObjectId;

    reason: string;
    evidence: string[];
    reportNote?: string;

    isResolved?: boolean;
    resolutionNote?: string;
    finalNote?: string;
    isRefunded: boolean;
}
