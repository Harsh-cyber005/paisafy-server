import mongoose, { Document, Schema } from 'mongoose';

export interface IJar extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    jarName: string;
    goalAmount: number;
    amountSaved: number;
}

const JarSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jarName: { type: String, required: true, trim: true },
    goalAmount: { type: Number, required: true },
    amountSaved: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model<IJar>('Jar', JarSchema);