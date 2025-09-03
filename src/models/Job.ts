import mongoose, { Document, Schema } from 'mongoose';

export interface IJob extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    lastUpdatedMonth: number;
    lastUpdatedYear: number;
}

const JobSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastUpdatedMonth: { type: Number, default: new Date().getMonth() + 1 },
    lastUpdatedYear: { type: Number, default: new Date().getFullYear() }
}, { timestamps: true });

export default mongoose.model<IJob>('Job', JobSchema);