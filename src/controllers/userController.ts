import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';
import { redisClient } from '../config/redisClient';

export const updateUserProfileSchema = z.object({
    body: z.object({
        fullName: z.string().min(2).optional(),
        monthlyIncome: z.number().min(0).optional(),
        incomeType: z.enum(['Monthly', 'Irregular']).optional(),
        financeTipsOptIn: z.boolean().optional(),
    }),
});

export const incomeSourceSchema = z.object({
    body: z.object({
        sourceName: z.string().min(2, { message: 'Source name is required' }),
        amount: z.number().min(0, { message: 'Amount must be a positive number' }),
    }),
});

export const recurringExpenseSchema = z.object({
    body: z.object({
        expenseName: z.string().min(2, { message: 'Expense name is required' }),
        amount: z.number().min(0, { message: 'Amount must be a positive number' }),
    }),
});


export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const cacheKey = `user-profile:${userEmail}`;

        const cachedProfile = await redisClient.get(cacheKey);
        if (cachedProfile) {
            return res.status(200).json(JSON.parse(cachedProfile));
        }

        const user = await User.findOne({ email: userEmail }).select('-password -otp -otpExpires');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

const invalidateProfileCache = async (email: string) => {
    const cacheKey = `user-profile:${email}`;
    await redisClient.del(cacheKey);
};

export const updateUserProfile = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOneAndUpdate({ email: userEmail }, { $set: req.body }, { new: true }).select('-password -otp');

        if (!user) return res.status(404).json({ message: 'User not found' });

        await invalidateProfileCache(userEmail);
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const addIncomeSource = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.incomeSources.push(req.body);
        await user.save();

        await invalidateProfileCache(userEmail);
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateIncomeSource = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const { sourceId } = req.params;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const source = user.incomeSources.id(sourceId);
        if (!source) return res.status(404).json({ message: 'Income source not found' });

        source.set(req.body);
        await user.save();

        await invalidateProfileCache(userEmail);
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteIncomeSource = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const { sourceId } = req.params;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.incomeSources.pull(sourceId);
        await user.save();

        await invalidateProfileCache(userEmail);
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const addRecurringExpense = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.recurringExpenses.push(req.body);
        await user.save();

        await invalidateProfileCache(userEmail);
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateRecurringExpense = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const { expenseId } = req.params;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const expense = user.recurringExpenses.id(expenseId);
        if (!expense) return res.status(404).json({ message: 'Expense not found' });

        expense.set(req.body);
        await user.save();

        await invalidateProfileCache(userEmail);
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteRecurringExpense = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const { expenseId } = req.params;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.recurringExpenses.pull(expenseId);
        await user.save();

        await invalidateProfileCache(userEmail);
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};