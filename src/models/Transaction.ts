import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    amount: number;
    type: 'Expense' | 'Income';
    category: string;
    description?: string;
    transactionDate: Date;
}

const TransactionSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['Expense', 'Income'], required: true },
    category: { type: String, required: true, trim: true, default: 'General' },
    description: { type: String, trim: true },
    transactionDate: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);