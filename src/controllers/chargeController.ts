import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import User from '../models/User';
import UpcomingCharge from '../models/UpcomingCharge';
import { redisClient } from '../config/redisClient';
import Transaction from '../models/Transaction';
import { invalidateInsightsCache } from './insightController';

export const createChargeSchema = z.object({
    body: z.object({
        chargeName: z.string().min(2, { message: 'Charge name is required' }),
        field: z.string().min(2, { message: 'Field/category is required' }),
        dueDate: z.string().datetime({ message: 'Please provide a valid due date in ISO 8601 format' }),
        amount: z.number().positive({ message: 'Amount must be a positive number' }),
    }),
});

export const updateChargeSchema = z.object({
    body: createChargeSchema.shape.body.partial(),
});

const invalidateChargesCache = async (userEmail: string) => {
    const keys = await redisClient.keys(`charges:${userEmail}:*`);
    if (keys.length > 0) {
        await redisClient.del(keys);
    }
};

const invalidateTransactionCaches = async (userEmail: string) => {
    const keys = await redisClient.keys(`transactions:${userEmail}:*`);
    const summaryKeys = await redisClient.keys(`summary:${userEmail}:*`);
    const allKeys = [...keys, ...summaryKeys];
    if (allKeys.length > 0) {
        await redisClient.del(allKeys);
    }
};

const updateOverdueCharges = async (userId: mongoose.Types.ObjectId) => {
    await UpcomingCharge.updateMany(
        { userId, dueDate: { $lt: new Date() }, isPaid: false, status: 'Upcoming' },
        { $set: { status: 'Due' } }
    );
};

export const createCharge = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const newCharge = new UpcomingCharge({
            ...req.body,
            userId: user._id,
        });
        await newCharge.save();

        await invalidateChargesCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(201).json(newCharge);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getAllCharges = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        await updateOverdueCharges(user._id);

        const status = (req.query.status as string) || 'Upcoming';
        const cacheKey = `charges:${userEmail}:status-${status}`;

        const cachedCharges = await redisClient.get(cacheKey);
        if (cachedCharges) {
            return res.status(200).json(JSON.parse(cachedCharges));
        }

        const charges = await UpcomingCharge.find({ userId: user._id, status: status, isPaid: false }).sort({ dueDate: 1 });

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(charges));
        res.status(200).json(charges);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getDues = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        await updateOverdueCharges(user._id);
        const cacheKey = `charges:${userEmail}:status-Due`;

        const cachedDues = await redisClient.get(cacheKey);
        if (cachedDues) {
            return res.status(200).json(JSON.parse(cachedDues));
        }

        const dueCharges = await UpcomingCharge.find({ userId: user._id, status: 'Due' }).sort({ dueDate: 1 });

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(dueCharges));
        res.status(200).json(dueCharges);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateCharge = async (req: Request, res: Response) => {
    try {
        const { chargeId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updatedCharge = await UpcomingCharge.findOneAndUpdate(
            { _id: chargeId, userId: user._id },
            req.body,
            { new: true }
        );
        if (!updatedCharge) return res.status(404).json({ message: 'Charge not found or access denied.' });

        await invalidateChargesCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json(updatedCharge);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const markChargeAsPaid = async (req: Request, res: Response) => {
    try {
        const { chargeId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updatedCharge = await UpcomingCharge.findOneAndUpdate(
            { _id: chargeId, userId: user._id },
            { isPaid: true, status: 'Paid' },
            { new: true }
        );
        if (!updatedCharge) return res.status(404).json({ message: 'Charge not found or access denied.' });
        await Transaction.create({
            userId: user._id,
            amount: updatedCharge.amount,
            type: "Expense",
            status: 'Completed',
            category: updatedCharge.field,
            description: `Paid charge: ${updatedCharge._id}`,
            transactionDate: new Date(),
        });

        await invalidateTransactionCaches(userEmail);
        await invalidateChargesCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json(updatedCharge);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const markChargeAsNotPaid = async (req: Request, res: Response) => {
    try {
        const { chargeId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const updatedCharge = await UpcomingCharge.findOneAndUpdate(
            { _id: chargeId, userId: user._id },
            { isPaid: false, status: 'Due' },
            { new: true }
        );
        if (!updatedCharge) return res.status(404).json({ message: 'Charge not found or access denied.' });
        const alreadyPaidTransaction = await Transaction.findOne({ description: `Paid charge: ${updatedCharge._id}` });
        if (alreadyPaidTransaction) {
            await Transaction.deleteOne({ _id: alreadyPaidTransaction._id });
        }
        await invalidateTransactionCaches(userEmail);
        await invalidateChargesCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json(updatedCharge);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteCharge = async (req: Request, res: Response) => {
    try {
        const { chargeId } = req.params;
        const userEmail = req.user!.email;
        const user = await User.findOne({ email: userEmail }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const deletedCharge = await UpcomingCharge.findOneAndDelete({ _id: chargeId, userId: user._id });
        if (!deletedCharge) return res.status(404).json({ message: 'Charge not found or access denied.' });

        await invalidateChargesCache(userEmail);
        await invalidateInsightsCache(userEmail);
        res.status(200).json({ message: 'Charge deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};