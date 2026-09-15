import { Schema, model } from 'mongoose';
import { IAdditionalTask, IPhotoRequirement } from './additional_task.interface';

const photoRequirementSchema = new Schema<IPhotoRequirement>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
    
        photo_url: {
            type: String,
            default: null,
        },
        is_uploaded: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

const additionalTaskSchema = new Schema<IAdditionalTask>(
    {
        cleaning_plan_id: {
            type: Schema.Types.ObjectId,
            ref: 'CleaningPlan',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description:{
            type:String,
            default:""
        },
        duration_minutes: {
            type: Number,
            required: true,
            min: 0,
        },
        is_photo_required: {
            type: Boolean,
            default: false,
        },
        photo_requirements: {
            type: [photoRequirementSchema] as unknown as typeof photoRequirementSchema[],
            default: [],
        },
        is_completed: {
            type: Boolean,
            default: false,
        },
        date_time: {
            type: Date,
            required: true,
        },
        is_approved: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const AdditionalTask = model<IAdditionalTask>(
    'AdditionalTask',
    additionalTaskSchema
);
