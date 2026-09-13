import { Schema, model } from 'mongoose';
import { IIssueReport, ISSUE_SEVERITY } from './issue_report.interface';

const issueReportSchema = new Schema<IIssueReport>(
    {
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
        isResolved: {
            type: Boolean,
            default: false,
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
