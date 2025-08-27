import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IIncomeSource extends Types.Subdocument {
    sourceName: string;
    amount: number;
}

export interface IRecurringExpense extends Types.Subdocument {
    expenseName: string;
    amount: number;
}

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId; 
    fullName: string;
    email: string;
    password: string;
    otp?: string;
    otpExpires?: Date;
    monthlyIncome: number;
    incomeType: 'Monthly' | 'Irregular';
    incomeSources: Types.DocumentArray<IIncomeSource>;
    recurringExpenses: Types.DocumentArray<IRecurringExpense>;
    financeTipsOptIn: boolean;
    onboardingDone: boolean;
}

const IncomeSourceSchema: Schema = new Schema({
    sourceName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true }
});

const RecurringExpenseSchema: Schema = new Schema({
    expenseName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true }
});

const UserSchema: Schema = new Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    monthlyIncome: { type: Number, required: true, default: 0 },
    incomeType: { type: String, enum: ['Monthly', 'Irregular'], required: true },
    incomeSources: [IncomeSourceSchema],
    recurringExpenses: [RecurringExpenseSchema],
    financeTipsOptIn: { type: Boolean, default: false },
    onboardingDone: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);