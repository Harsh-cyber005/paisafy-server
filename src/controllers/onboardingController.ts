import { Request, Response } from 'express';
import { z } from 'zod';
import User, { IIncomeSource, IRecurringExpense } from '../models/User';
import Goal from '../models/Goal';
import { redisClient } from '../config/redisClient';
import { Types } from 'mongoose';
import Transaction from '../models/Transaction';
import Jar from '../models/Jar';

export const onboardingSchema = z.object({
    body: z.object({
        income: z.object({
            monthlyIncome: z.coerce.number().positive(),
            incomeType: z.enum(['monthly', 'irregular']),
            additionalSources: z.array(z.object({
                name: z.string().min(1),
                amount: z.coerce.number().positive(),
            })).optional(),
        }),
        expenses: z.object({
            predefinedExpenses: z.record(z.string(), z.coerce.number().positive()),
            customExpenses: z.array(z.object({
                name: z.string().min(1),
                amount: z.coerce.number().positive(),
            })),
        }),
        goals: z.object({
            predefinedGoals: z.record(z.string(), z.object({
                amount: z.coerce.number().positive(),
                date: z.string().optional(),
            })),
            customGoals: z.array(z.object({
                name: z.string().min(1),
                amount: z.coerce.number().positive(),
                date: z.string().optional(),
            })),
            financeTips: z.boolean(),
        }),
    }),
});

export const submitOnboarding = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.onboardingDone) return res.status(400).json({ message: 'Onboarding already completed.' });

        const { income, expenses, goals } = req.body;

        user.monthlyIncome = income.monthlyIncome;
        user.incomeType = income.incomeType === 'monthly' ? 'Monthly' : 'Irregular';
        
        const incomeSourcesData = income.additionalSources.map((source: any) => ({
            sourceName: source.name,
            amount: source.amount,
        }));
        user.incomeSources = incomeSourcesData as Types.DocumentArray<IIncomeSource>;
        const recurringExpensesData = [];
        for (const name in expenses.predefinedExpenses) {
            recurringExpensesData.push({ expenseName: name, amount: expenses.predefinedExpenses[name] });
        }
        for (const expense of expenses.customExpenses) {
            recurringExpensesData.push({ expenseName: expense.name, amount: expense.amount });
        }
        user.recurringExpenses = recurringExpensesData as Types.DocumentArray<IRecurringExpense>;

        const goalsToCreate = [];
        const jars = [];
        const predefinedGoalNames: Record<string, string> = {
            laptop: "New Laptop", trip: "Weekend Trip", emergency: "Build Emergency Fund", invest: "Invest in Stocks",
        };
        for (const id in goals.predefinedGoals) {
            goalsToCreate.push({
                userId: user._id,
                goalName: predefinedGoalNames[id] || 'Goal',
                targetAmount: goals.predefinedGoals[id].amount,
                targetDate: goals.predefinedGoals[id].date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            });
            jars.push({ userId: user._id, jarName: predefinedGoalNames[id] || 'Goal', goalAmount: goals.predefinedGoals[id].amount, amountSaved: 0 });
        }
        for (const goal of goals.customGoals) {
            goalsToCreate.push({
                userId: user._id,
                goalName: goal.name,
                targetAmount: goal.amount,
                targetDate: goal.date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            });
            jars.push({ userId: user._id, jarName: goal.name, goalAmount: goal.amount, amountSaved: 0 });
        }
        if (goalsToCreate.length > 0) {
            await Goal.insertMany(goalsToCreate);
        }
        if (jars.length > 0) {
            await Jar.insertMany(jars);
        }

        const incomeTransaction = new Transaction({
            userId: user._id,
            amount: user.monthlyIncome,
            type: 'RecurringIncome',
            category: 'Income',
            description: 'User onboarding monthly income',
            transactionDate: new Date(),
        });
        await incomeTransaction.save();

        const expenseTransactions = user.recurringExpenses.map(expense => new Transaction({
            userId: user._id,
            amount: expense.amount,
            type: 'RecurringExpense',
            category: 'Recurring',
            description: `User onboarding recurring expense: ${expense.expenseName}`,
            transactionDate: new Date(),
        }));
        await Transaction.insertMany(expenseTransactions);

        const transactionsFromIncomeSources = user.incomeSources.map(source => new Transaction({
            userId: user._id,
            amount: source.amount,
            type: 'RecurringIncome',
            category: 'Additional Income',
            description: `User onboarding additional income source: ${source.sourceName}`,
            transactionDate: new Date(),
        }));
        await Transaction.insertMany(transactionsFromIncomeSources);

        user.financeTipsOptIn = goals.financeTips;
        user.onboardingDone = true;
        await user.save();

        await redisClient.del(`user-profile:${userEmail}`);
        await redisClient.del(`goals:${userEmail}`);

        res.status(200).json({ message: 'Onboarding completed successfully!', user });

    } catch (error) {
        console.error("Onboarding submission error:", error);
        res.status(500).json({ message: 'Server error during onboarding submission', error });
    }
};