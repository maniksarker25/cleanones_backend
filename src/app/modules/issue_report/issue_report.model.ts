import { Schema, model } from 'mongoose';
import { IIssueReport, ISSUE_SEVERITY, ISSUE_STATUS } from './issue_report.interface';

const issueReportSchema = new Schema<IIssueReport>(
    {
        worker: {
            type: Schema.Types.ObjectId,
            ref: 'Worker',
            required: true,
            immutable: true,
            index: true,
        },
        issueType: {
            type: String,
            required: true,
            trim: true,
        },
        severity: {
            type: String,
            enum: ISSUE_SEVERITY,
            required: true,
        },
        location: {
            type: Schema.Types.ObjectId,
            ref: 'Location',
            required: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ISSUE_STATUS,
            default: 'PENDING',
        },
        resolution_note: {
            type: String,
            trim: true,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const IssueReport = model<IIssueReport>(
    'IssueReport',
    issueReportSchema,
    'issue_reports'
);
