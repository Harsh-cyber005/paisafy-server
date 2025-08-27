import { Router } from 'express';
import { protect } from "../middlewares/auth"
import { validate } from '../middlewares/validate';
import {
    getUserProfile,
    updateUserProfile,
    addIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    updateUserProfileSchema,
    incomeSourceSchema,
    recurringExpenseSchema
} from '../controllers/userController';

const userRouter = Router();

userRouter.use(protect);

userRouter.route('/profile')
    .get(getUserProfile)
    .put(validate(updateUserProfileSchema), updateUserProfile);

userRouter.route('/profile/income-sources')
    .post(validate(incomeSourceSchema), addIncomeSource);

userRouter.route('/profile/income-sources/:sourceId')
    .put(validate(incomeSourceSchema), updateIncomeSource)
    .delete(deleteIncomeSource);

userRouter.route('/profile/recurring-expenses')
    .post(validate(recurringExpenseSchema), addRecurringExpense);

userRouter.route('/profile/recurring-expenses/:expenseId')
    .put(validate(recurringExpenseSchema), updateRecurringExpense)
    .delete(deleteRecurringExpense);

export default userRouter;