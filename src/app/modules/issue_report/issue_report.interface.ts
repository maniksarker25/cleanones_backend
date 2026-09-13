import { Types } from 'mongoose';

export const ISSUE_SEVERITY = ['Low', 'Medium', 'High'] as const;

export interface IIssueReport {
    issueType: string;
    severity: (typeof ISSUE_SEVERITY)[number];
    location: Types.ObjectId;
    description: string;
    isResolved: boolean;
}
