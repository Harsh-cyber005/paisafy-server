import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';
import Transaction from '../models/Transaction';
import { redisClient } from '../config/redisClient';

export const transactionSchema = z.object({
    body: z.object({
        amount: z.number().positive({ message: 'Amount must be a positive number' }),
        type: z.enum(['Income', 'Expense']),
        category: z.string().min(2, { message: 'Category is required' }),
        description: z.string().optional(),
        transactionDate: z.string().datetime().optional(),
    }),
});

export const updateTransactionSchema = z.object({
    body: transactionSchema.shape.body.partial(),
});

const invalidateTransactionCaches = async (userEmail: string) => {
    const keys = await redisClient.keys(`transactions:${userEmail}:*`);
    const summaryKeys = await redisClient.keys(`summary:${userEmail}:*`);
    const allKeys = [...keys, ...summaryKeys];
    if (allKeys.length > 0) {
        await redisClient.del(allKeys);
    }
};

export const createTransaction = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newTransaction = new Transaction({
            ...req.body,
            userId: user._id,
        });

        await newTransaction.save();

        await invalidateTransactionCaches(userEmail);

        res.status(201).json(newTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

export const getAllTransactions = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { page = '1', limit = '10', type, month, year } = req.query;

        const cacheKey = `transactions:${userEmail}:page-${page}-limit-${limit}-type-${type || 'all'}-month-${month || 'all'}-year-${year || 'all'}`;

        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }

        const query: any = { userId: user._id };
        if (type) query.type = type;
        if (month && year) {
            const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
            const endDate = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
            query.transactionDate = { $gte: startDate, $lte: endDate };
        }

        const transactions = await Transaction.find(query)
            .sort({ transactionDate: -1 })
            .limit(parseInt(limit as string))
            .skip((parseInt(page as string) - 1) * parseInt(limit as string));

        const total = await Transaction.countDocuments(query);

        const response = {
            transactions,
            totalPages: Math.ceil(total / parseInt(limit as string)),
            currentPage: parseInt(page as string),
        };

        await redisClient.setEx(cacheKey, 900, JSON.stringify(response));

        res.status(200).json(response);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

export const getTransactionSummary = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id incomeSources');
        if (!user) return res.status(404).json({ message: 'User not found' });
        let sideIncomes = 0;
        try{
            sideIncomes = user.incomeSources.reduce((acc, source) => acc + source.amount, 0);
        }catch(error){
            console.error('Error calculating side incomes:', error);
        }

        const { month, year } = req.query;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const targetYear = year ? parseInt(year as string) : currentYear;
        const targetMonth = month ? parseInt(month as string) : currentMonth;

        const cacheKey = `summary:${userEmail}:month-${targetMonth}-year-${targetYear}`;
        const cachedSummary = await redisClient.get(cacheKey);
        if (cachedSummary) {
            return res.status(200).json(JSON.parse(cachedSummary));
        }

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        const summary = await Transaction.aggregate([
            { $match: { userId: user._id, transactionDate: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$type', totalAmount: { $sum: '$amount' } } }
        ]);

        const result = {
            totalIncome: summary.find(s => s._id === 'Income')?.totalAmount || 0,
            totalExpense: summary.find(s => s._id === 'Expense')?.totalAmount || 0
        };

        await redisClient.setEx(cacheKey, 900, JSON.stringify(result));

        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

export const getTransactionById = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const transaction = await Transaction.findOne({ _id: req.params.transactionId, userId: user._id });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or you do not have permission to view it.' });
        }
        res.status(200).json(transaction);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

export const updateTransaction = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updatedTransaction = await Transaction.findOneAndUpdate(
            { _id: req.params.transactionId, userId: user._id },
            req.body,
            { new: true }
        );

        if (!updatedTransaction) {
            return res.status(404).json({ message: 'Transaction not found or you do not have permission to update it.' });
        }

        await invalidateTransactionCaches(userEmail);
        res.status(200).json(updatedTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

export const deleteTransaction = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const deletedTransaction = await Transaction.findOneAndDelete({ _id: req.params.transactionId, userId: user._id });
        if (!deletedTransaction) {
            return res.status(404).json({ message: 'Transaction not found or you do not have permission to delete it.' });
        }

        await invalidateTransactionCaches(userEmail);
        res.status(200).json({ message: 'Transaction deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

export const getSpendingTrend = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const daysInMonth = endDate.getDate();

        const dbTrend = await Transaction.aggregate([
            {
                $match: {
                    userId: user._id,
                    type: 'Expense',
                    transactionDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $dayOfMonth: "$transactionDate" },
                    totalAmount: { $sum: "$amount" }
                }
            },
            { $sort: { "_id": 1 } },
            {
                $project: {
                    _id: 0,
                    day: { $toString: "$_id" },
                    amount: "$totalAmount"
                }
            }
        ]);

        const trendMap = new Map<string, number>();
        dbTrend.forEach(item => {
            trendMap.set(item.day, item.amount);
        });

        const fullMonthTrend = Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1);
            return {
                day: day,
                amount: trendMap.get(day) || 0
            };
        });

        res.status(200).json(fullMonthTrend);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};
