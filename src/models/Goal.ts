import mongoose, { Document, Schema } from 'mongoose';

export interface IGoal extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    goalName: string;
    targetAmount: number;
    amountSaved: number;
    targetDate: Date;
    status: 'In Progress' | 'Completed';
}

const GoalSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    goalName: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true },
    amountSaved: { type: Number, required: true, default: 0 },
    targetDate: { type: Date, required: true },
    status: { type: String, enum: ['In Progress', 'Completed'], default: 'In Progress' }
}, { timestamps: true });

export default mongoose.model<IGoal>('Goal', GoalSchema);