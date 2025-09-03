import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';
import Jar from '../models/Jar';
import { redisClient } from '../config/redisClient';
import Transaction from '../models/Transaction';
import { invalidateInsightsCache } from './insightController';

export const createJarSchema = z.object({
    body: z.object({
        jarName: z.string().min(2, { message: 'Jar name is required' }),
        goalAmount: z.number().positive({ message: 'Goal amount must be a positive number' }),
    }),
});

export const updateJarSchema = z.object({
    body: createJarSchema.shape.body.partial(),
});

export const moneyTransactionSchema = z.object({
    body: z.object({
        amount: z.number().positive({ message: 'Amount must be a positive number' }),
    }),
});

const invalidateTransactionCaches = async (userEmail: string) => {
    const keys = await redisClient.keys(`transactions:${userEmail}:*`);
    const summaryKeys = await redisClient.keys(`summary:${userEmail}:*`);
    const allKeys = [...keys, ...summaryKeys];
    if (allKeys.length > 0) {
        await redisClient.del(allKeys);
    }
};

const invalidateJarsCache = async (userEmail: string) => {
    const cacheKey = `jars:${userEmail}`;
    await redisClient.del(cacheKey);
};

export const createJar = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const newJar = new Jar({
            ...req.body,
            userId: user._id,
        });
        await newJar.save();

        await invalidateJarsCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(201).json(newJar);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getAllJars = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const cacheKey = `jars:${userEmail}`;

        const cachedJars = await redisClient.get(cacheKey);
        if (cachedJars) {
            return res.status(200).json(JSON.parse(cachedJars));
        }

        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const jars = await Jar.find({ userId: user._id }).sort({ createdAt: 1 });

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(jars));
        res.status(200).json(jars);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateJar = async (req: Request, res: Response) => {
    try {
        const { jarId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updatedJar = await Jar.findOneAndUpdate(
            { _id: jarId, userId: user._id },
            req.body,
            { new: true }
        );
        if (!updatedJar) return res.status(404).json({ message: 'Jar not found or access denied.' });

        await invalidateJarsCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json(updatedJar);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const depositToJar = async (req: Request, res: Response) => {
    try {
        const { jarId } = req.params;
        const { amount } = req.body;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const jar = await Jar.findOne({ _id: jarId, userId: user._id });
        if (!jar) return res.status(404).json({ message: 'Jar not found or access denied.' });

        await new Transaction({
            userId: user._id,
            amount: -1 * amount,
            type: 'Income',
            description: `Deposit to jar: ${jar.jarName}`,
        }).save();

        jar.amountSaved += amount;
        await jar.save();

        await invalidateTransactionCaches(userEmail);
        await invalidateJarsCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json(jar);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const withdrawFromJar = async (req: Request, res: Response) => {
    try {
        const { jarId } = req.params;
        const { amount } = req.body;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const jar = await Jar.findOne({ _id: jarId, userId: user._id });
        if (!jar) return res.status(404).json({ message: 'Jar not found or access denied.' });

        if (jar.amountSaved < amount) {
            return res.status(400).json({ message: 'Withdrawal amount cannot be greater than the saved amount.' });
        }

        await new Transaction({
            userId: user._id,
            amount,
            type: 'Income',
            description: `Withdraw from jar: ${jar.jarName}`,
        }).save();

        jar.amountSaved -= amount;
        await jar.save();

        await invalidateTransactionCaches(userEmail);
        await invalidateJarsCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json(jar);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteJar = async (req: Request, res: Response) => {
    try {
        const { jarId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const deletedJar = await Jar.findOneAndDelete({ _id: jarId, userId: user._id });
        if (!deletedJar) return res.status(404).json({ message: 'Jar not found or access denied.' });
        
        await Transaction.deleteMany({ userId: user._id, description: `Deposit to jar: ${deletedJar.jarName}` });
        await invalidateTransactionCaches(userEmail);
        await invalidateJarsCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json({ message: 'Jar deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};