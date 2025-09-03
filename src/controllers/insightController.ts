import { Request, Response } from 'express';
import User from '../models/User';
import Jar from '../models/Jar';
import Transaction from '../models/Transaction';
import UpcomingCharge from '../models/UpcomingCharge';

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { redisClient } from '../config/redisClient';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const responseSchema = {
    type: SchemaType.ARRAY as const,
    minItems: 2,
    maxItems: 4,
    items: {
        type: SchemaType.OBJECT as const,
        properties: {
            title: { type: SchemaType.STRING as const },
            description: { type: SchemaType.STRING as const },
            emoji: { type: SchemaType.STRING as const }
        },
        required: ["title", "description", "emoji"]
    }
};

interface Insight {
    title: string;
    description: string;
    emoji: string;
}

async function fetchAIInsights(sentences: string): Promise<Insight[]> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema
        }
    });

    const prompt = `
    You are a helpful financial assistant. 
    Based on the following user data, generate exactly 2–4 insights. 
    Each insight must be an object with "title", "description", and "emoji".
    Each emoji should match the intent of the title.
    Respond ONLY with the JSON array.

    User Insights Sentences: ${sentences}
    `;

    const result = await model.generateContent(prompt);

    const text = result.response.text();
    return JSON.parse(text) as Insight[];
}

async function convertDataToSentences(email: string) : Promise<string> {
    const user = await User.findOne({ email });
    if (!user) return "";

    var fullSentence = `today is Year: ${new Date().getFullYear()}, Month: ${new Date().getMonth() + 1}, Day: ${new Date().getDate()}.`;
    const uId = user._id;
    const totalMonthlyIncome = user.incomeSources.reduce((acc, source) => acc + source.amount, 0) + user.monthlyIncome;
    const totalMonthlyExpense = user.recurringExpenses.reduce((acc, expense) => acc + expense.amount, 0);

    fullSentence += `User has a total monthly income of ₹${totalMonthlyIncome} and a total monthly expense of ₹${totalMonthlyExpense}. `;

    const goals = await Jar.find({ userId: uId });
    const goalSentences = goals.map(goal => `User has a goal named ${goal.jarName}, having a target amount of ₹${goal.goalAmount}, Total saved for this goal: ₹${goal.amountSaved}.`);
    fullSentence += goalSentences.join(" ");
    fullSentence += " ";

    const irregularPastIncomesForTheYear = await Transaction.find({ userId: uId, type: 'Income', date: { $gte: new Date(new Date().getFullYear(), 0, 1), $lt: new Date(new Date().getFullYear() + 1, 0, 1) } });
    const incomeSentences = irregularPastIncomesForTheYear.map(inc => `User received an irregular income of ₹${inc.amount} on ${inc.transactionDate.toISOString().split("T")[0]} for ${inc.description}.`);
    fullSentence += incomeSentences.join(" ");
    fullSentence += " ";

    const irregularPastExpensesForTheYear = await Transaction.find({ userId: uId, type: 'Expense', date: { $gte: new Date(new Date().getFullYear(), 0, 1), $lt: new Date(new Date().getFullYear() + 1, 0, 1) } });
    const expenseSentences = irregularPastExpensesForTheYear.map(exp => `User had an irregular expense of ₹${exp.amount} on ${exp.transactionDate.toISOString().split("T")[0]} for ${exp.description}.`);
    fullSentence += expenseSentences.join(" ");
    fullSentence += " ";

    const upcomingCharges = await UpcomingCharge.find({userId: uId, dueDate: { $gte: new Date() }, isPaid: false, status: 'Upcoming' });
    const upcomingChargeSentences = upcomingCharges.map(charge => `User has an upcoming charge of ₹${charge.amount} on ${charge.dueDate.toISOString().split("T")[0]} for ${charge.chargeName} (field:${charge.field}).`);
    fullSentence += upcomingChargeSentences.join(" ");
    fullSentence += " ";

    const chargesDue = await UpcomingCharge.find({userId: uId, dueDate: { $lt: new Date() }, isPaid: false, status: 'Due' });
    const chargeDueSentences = chargesDue.map(charge => `User has an overdue charge of ₹${charge.amount} on ${charge.dueDate.toISOString().split("T")[0]} for ${charge.chargeName} (field:${charge.field}).`);
    fullSentence += chargeDueSentences.join(" ");

    return fullSentence;
}

export const invalidateInsightsCache = async (userEmail: string) => {
    const keys = await redisClient.keys(`insights:${userEmail}`);
    if (keys.length > 0) {
        await redisClient.del(keys);
    }
};

export const getUserInsights = async (req: Request, res: Response) => {
    try {
        const cacheKey = `insights:${req.user!.email}`;
        const cachedInsights = await redisClient.get(cacheKey);
        if (cachedInsights) {
            return res.status(200).json({ message: 'Insights fetched from cache!', data: JSON.parse(cachedInsights) });
        }

        const sentences = await convertDataToSentences(req.user!.email);
        const insights = await fetchAIInsights(sentences);

        await redisClient.setEx(cacheKey, 900, JSON.stringify(insights));
        res.status(200).json({ message: 'Insights fetched successfully!', data: insights });
    } catch (error) {
        console.error("Insights error:", error);
        res.status(500).json({ message: 'Server error during fetching insights', error });
    }
};