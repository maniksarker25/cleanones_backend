import { Schema, model } from 'mongoose';
import {
    ADDITIONAL_TASK_STATUS,
    IAdditionalTask,
    IPhotoRequirement,
} from './additional_task.interface';

const photoRequirementSchema = new Schema<IPhotoRequirement>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: null,
            trim: true,
        },
        reference_image_url: {
            type: String,
            default: null,
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
            default: null,
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
        status: {
            type: String,
            enum: ADDITIONAL_TASK_STATUS,
            default: 'Pending',
        },
        reject_reason: {
            type: String,
            default: null,
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
