import { Request, Response } from 'express';

const dummyAIInsights = [
    {
        title: "Great job! 🎉",
        description: "You're spending 15% less than last month",
        bg: "bg-green-500/10 border border-green-500/20",
        titleColor: "text-green-700 dark:text-green-400",
        descColor: "text-green-600 dark:text-green-400"
    },
    {
        title: "Tip 💡",
        description: "Consider increasing your Emergency Fund by ₹500/month",
        bg: "bg-blue-500/10 border border-blue-500/20",
        titleColor: "text-blue-700 dark:text-blue-400",
        descColor: "text-blue-600 dark:text-blue-400"
    },
    {
        title: "Suggestion 📈",
        description: "Try to reduce your dining expenses by ₹200/week",
        bg: "bg-orange-500/10 border border-orange-500/20",
        titleColor: "text-orange-700 dark:text-orange-400",
        descColor: "text-orange-600 dark:text-orange-400"
    },
    {
        title: "Reminder ⏰",
        description: "Don't forget to review your budget at the end of the month",
        bg: "bg-red-500/10 border border-red-500/20",
        titleColor: "text-red-700 dark:text-red-400",
        descColor: "text-red-600 dark:text-red-400"
    }
];

export const getUserInsights = async (req: Request, res: Response) => {
    try {
        res.status(200).json({ message: 'Insights fetched successfully!', data: dummyAIInsights });
    } catch (error) {
        console.error("Insights error:", error);
        res.status(500).json({ message: 'Server error during fetching insights', error });
    }
};