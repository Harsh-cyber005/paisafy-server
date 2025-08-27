import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
    createGoal,
    getAllGoals,
    getGoalById,
    updateGoal,
    contributeToGoal,
    deleteGoal,
    createGoalSchema,
    updateGoalSchema,
    contributeToGoalSchema
} from '../controllers/goalController';

const goalRouter = Router();

goalRouter.use(protect);

goalRouter.route('/')
    .post(validate(createGoalSchema), createGoal)
    .get(getAllGoals);

goalRouter.route('/:goalId')
    .get(getGoalById)
    .put(validate(updateGoalSchema), updateGoal)
    .delete(deleteGoal);

goalRouter.post('/:goalId/contribute', validate(contributeToGoalSchema), contributeToGoal);

export default goalRouter;