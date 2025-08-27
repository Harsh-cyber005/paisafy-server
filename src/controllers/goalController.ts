import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';
import Goal from '../models/Goal';
import { redisClient } from '../config/redisClient';

export const createGoalSchema = z.object({
    body: z.object({
        goalName: z.string().min(3, { message: 'Goal name is required' }),
        targetAmount: z.number().positive({ message: 'Target amount must be a positive number' }),
        targetDate: z.string().datetime({ message: 'Please provide a valid target date in ISO 8601 format' }),
    }),
});

export const updateGoalSchema = z.object({
    body: createGoalSchema.shape.body.partial(), // All fields are optional
});

export const contributeToGoalSchema = z.object({
    body: z.object({
        amount: z.number().positive({ message: 'Contribution amount must be a positive number' }),
    }),
});

const invalidateUserGoalsCache = async (userEmail: string) => {
    const listCacheKey = `goals:${userEmail}`;
    await redisClient.del(listCacheKey);
};

const invalidateSingleGoalCache = async (goalId: string) => {
    const singleCacheKey = `goal:${goalId}`;
    await redisClient.del(singleCacheKey);
};

export const createGoal = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const newGoal = new Goal({
            ...req.body,
            userId: user._id,
        });
        await newGoal.save();

        await invalidateUserGoalsCache(userEmail);

        res.status(201).json(newGoal);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getAllGoals = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const cacheKey = `goals:${userEmail}`;

        const cachedGoals = await redisClient.get(cacheKey);
        if (cachedGoals) {
            return res.status(200).json(JSON.parse(cachedGoals));
        }

        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const goals = await Goal.find({ userId: user._id }).sort({ targetDate: 1 });

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(goals));

        res.status(200).json(goals);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getGoalById = async (req: Request, res: Response) => {
    try {
        const { goalId } = req.params;
        const cacheKey = `goal:${goalId}`;

        const cachedGoal = await redisClient.get(cacheKey);
        if (cachedGoal) {
            return res.status(200).json(JSON.parse(cachedGoal));
        }

        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const goal = await Goal.findOne({ _id: goalId, userId: user._id });
        if (!goal) return res.status(404).json({ message: 'Goal not found or access denied.' });

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(goal));

        res.status(200).json(goal);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateGoal = async (req: Request, res: Response) => {
    try {
        const { goalId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updatedGoal = await Goal.findOneAndUpdate(
            { _id: goalId, userId: user._id },
            req.body,
            { new: true }
        );

        if (!updatedGoal) return res.status(404).json({ message: 'Goal not found or access denied.' });

        await invalidateUserGoalsCache(userEmail);
        await invalidateSingleGoalCache(goalId);

        res.status(200).json(updatedGoal);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const contributeToGoal = async (req: Request, res: Response) => {
    try {
        const { goalId } = req.params;
        const { amount } = req.body;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const goal = await Goal.findOne({ _id: goalId, userId: user._id });
        if (!goal) return res.status(404).json({ message: 'Goal not found or access denied.' });
        if (goal.status === 'Completed') return res.status(400).json({ message: 'This goal has already been completed.' });

        goal.amountSaved += amount;

        if (goal.amountSaved >= goal.targetAmount) {
            goal.status = 'Completed';
        }

        await goal.save();

        await invalidateUserGoalsCache(userEmail);
        await invalidateSingleGoalCache(goalId);

        res.status(200).json(goal);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteGoal = async (req: Request, res: Response) => {
    try {
        const { goalId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const deletedGoal = await Goal.findOneAndDelete({ _id: goalId, userId: user._id });
        if (!deletedGoal) return res.status(404).json({ message: 'Goal not found or access denied.' });

        await invalidateUserGoalsCache(userEmail);
        await invalidateSingleGoalCache(goalId);

        res.status(200).json({ message: 'Goal deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};