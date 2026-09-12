import { model, Schema } from 'mongoose';
import { ENUM_REPORT_ROLE } from './report.enum';
import { IReport } from './report.interface';

const reportSchema = new Schema<IReport>(
    {
        reportBy: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'reportByRole',
        },

        reportByRole: {
            type: String,
            enum: Object.values(ENUM_REPORT_ROLE),
            required: true,
        },

        reportTo: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'reportToRole',
        },

        reportToRole: {
            type: String,
            enum: Object.values(ENUM_REPORT_ROLE),
            required: true,
        },

        task: {
            type: Schema.Types.ObjectId,
            ref: 'Task',
            required: true,
        },

        reason: {
            type: String,
            required: true,
            trim: true,
        },

        evidence: [
            {
                type: String,
                required: true,
            },
        ],

        isResolved: {
            type: Boolean,
            default: false,
        },

        resolutionNote: {
            type: String,
            default: null,
        },
        isRefunded: {
            type: Boolean,
            default: false,
        },
        reportNote: {
            type: String,
            default: '',
        },
        finalNote: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

reportSchema.index({ reportBy: 1, reportTo: 1, task: 1 }, { unique: true });
const Report = model<IReport>('Report', reportSchema);
export default Report;
