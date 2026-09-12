import { Types } from 'mongoose';

export interface ITestimonial {
    customer: Types.ObjectId; // ref -> Customer
    details: string;
    rating: number;
}
