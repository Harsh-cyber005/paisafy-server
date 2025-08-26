import mongoose, { Document, Schema } from 'mongoose';

export interface IUpcomingCharge extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    chargeName: string;
    field: string;
    dueDate: Date;
    amount: number;
    isPaid: boolean;
    status: 'Upcoming' | 'Paid' | 'Due';
}

const UpcomingChargeSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chargeName: { type: String, required: true, trim: true },
    field: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    status: { type: String, enum: ['Upcoming', 'Paid', 'Due'], default: 'Upcoming' }
}, { timestamps: true });

export default mongoose.model<IUpcomingCharge>('UpcomingCharge', UpcomingChargeSchema);