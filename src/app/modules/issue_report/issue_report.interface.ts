import { Types } from 'mongoose';

export const ISSUE_SEVERITY = ['Low', 'Medium', 'High'] as const;
export const ISSUE_STATUS = ['PENDING', 'IN_PROGRESS', 'RESOLVED'] as const;

export interface IIssueReport {
    worker: Types.ObjectId;
    issueType: string;
    severity: (typeof ISSUE_SEVERITY)[number];
    location: Types.ObjectId;
    description: string;
    status: (typeof ISSUE_STATUS)[number];
    // Set by the manager alongside (or after) marking the report RESOLVED —
    // what was actually done, surfaced back to the reporting worker.
    resolution_note?: string | null;
}
