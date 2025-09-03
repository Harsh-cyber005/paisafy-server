import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, {SignOptions} from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import User from '../models/User';
import { Mail } from '../config/send';
import Job from '../models/Job';
import Transaction from '../models/Transaction';
import { invalidateInsightsCache } from './insightController';
import { invalidateTransactionCaches } from './transactionController';

export const signupSchema = z.object({
    body: z.object({
        fullName: z.string().min(2, { message: 'Full name must be at least 2 characters long' }),
        email: z.email({ message: 'Please provide a valid email address' }),
        password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.email({ message: 'Please provide a valid email address' }),
        password: z.string().min(1, { message: 'Password is required' }),
    }),
});

export const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email({ message: 'Please provide a valid email address' }),
        otp: z.string().length(6, { message: 'OTP must be exactly 6 digits' }).regex(/^\d+$/, { message: 'OTP must only contain digits' }),
    }),
});

export const otpSchema = z.object({
    body: z.object({
        email: z.email({ message: 'Please provide a valid email address' })
    }),
});

export const signup = async (req: Request<{}, {}, z.infer<typeof signupSchema>['body']>, res: Response) => {
    const { fullName, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user = new User({
            fullName,
            email,
            password: hashedPassword,
            incomeType: 'Monthly',
        });
        await user.save();
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        console.error((err as Error).message);
        res.status(500).send('Server error');
    }
};

export const login = async (req: Request<{}, {}, z.infer<typeof loginSchema>['body']>, res: Response) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        const payload = { email: user.email };
        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpiration = process.env.JWT_EXPIRATION;

        if (!jwtSecret || !jwtExpiration) {
            console.error('JWT_SECRET or JWT_EXPIRATION is not defined in environment variables.');
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        const expiresInSeconds = parseInt(jwtExpiration, 10);
        const signOptions: SignOptions = {
            expiresIn: expiresInSeconds,
        };
        const token = jwt.sign(
            payload,
            jwtSecret,
            signOptions
        );
        res.status(200).json({
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email
            }
        });
    } catch (err) {
        console.error((err as Error).message);
        res.status(500).send('Server error');
    }
};

export const sendOTP = async(req: Request<{}, {}, z.infer<typeof otpSchema>['body']>, res: Response) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const otp = crypto.randomInt(100000, 999999).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        console.log(`[DEV-ONLY] OTP for ${user.email}: ${otp}`);
        await Mail({ emailAddress: user.email, userName: user.fullName, otp });
        res.status(200).json({ message: 'OTP sent to email.' });
    } catch (err) {
        console.error((err as Error).message);
        res.status(500).send('Server error');
    }
};

export const verifyOtpAndLogin = async (req: Request<{}, {}, z.infer<typeof verifyOtpSchema>['body']>, res: Response) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: new Date() },
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP. Please try logging in again.' });
        }
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();
        const payload = { email: user.email };
        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpiration = process.env.JWT_EXPIRATION;

        if (!jwtSecret || !jwtExpiration) {
            console.error('JWT_SECRET or JWT_EXPIRATION is not defined in environment variables.');
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        const expiresInSeconds = parseInt(jwtExpiration, 10);
        const signOptions: SignOptions = {
            expiresIn: expiresInSeconds,
        };
        const token = jwt.sign(
            payload,
            jwtSecret,
            signOptions
        );
        res.status(200).json({
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email
            }
        });
    } catch (err) {
        console.error((err as Error).message);
        res.status(500).send('Server error');
    }
};

export const userDetails = async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication error: User data not found on request.' });
    }
    const { email } = req.user;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const job = await Job.findOne({ userId: user._id });
        if(!job) {
            const recurringTotalIncomes = user.incomeSources.reduce((acc, source) => acc + source.amount, 0) + user.monthlyIncome;
            const recurringTotalExpenses = user.recurringExpenses.reduce((acc, expense) => acc + expense.amount, 0);
            await Transaction.create({
                userId: user._id,
                amount: recurringTotalIncomes,
                type: 'RecurringIncome',
                category: 'Recurring Income',
            });
            await Transaction.create({
                userId: user._id,
                amount: recurringTotalExpenses,
                type: 'RecurringExpense',
                category: 'Recurring Expense',
            });
            const newJob = new Job({
                userId: user._id,
                lastUpdatedMonth: new Date().getMonth() + 1,
                lastUpdatedYear: new Date().getFullYear()
            });
            await newJob.save();
            await invalidateTransactionCaches(user.email);
            await invalidateInsightsCache(user.email);
        } else if (job.lastUpdatedMonth !== new Date().getMonth() + 1 || job.lastUpdatedYear !== new Date().getFullYear()) {
            const recurringTotalIncomes = user.incomeSources.reduce((acc, source) => acc + source.amount, 0) + user.monthlyIncome;
            const recurringTotalExpenses = user.recurringExpenses.reduce((acc, expense) => acc + expense.amount, 0);
            await Transaction.create({
                userId: user._id,
                amount: recurringTotalIncomes,
                type: 'RecurringIncome',
                category: 'Recurring Income',
            });
            await Transaction.create({
                userId: user._id,
                amount: recurringTotalExpenses,
                type: 'RecurringExpense',
                category: 'Recurring Expense',
            });
            await invalidateTransactionCaches(user.email);
            await invalidateInsightsCache(user.email);
            job.lastUpdatedMonth = new Date().getMonth() + 1;
            job.lastUpdatedYear = new Date().getFullYear();
            await job.save();
        }
        const { fullName, onboardingDone } = user;
        res.status(200).json({ email, fullName, onboardingDone });
    } catch (err) {
        console.error((err as Error).message);
        res.status(500).send('Server error');
    }
};