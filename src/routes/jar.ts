import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
    createJar,
    getAllJars,
    updateJar,
    depositToJar,
    withdrawFromJar,
    deleteJar,
    createJarSchema,
    updateJarSchema,
    moneyTransactionSchema
} from '../controllers/jarController';

const jarRouter = Router();

jarRouter.use(protect);

jarRouter.route('/')
    .post(validate(createJarSchema), createJar)
    .get(getAllJars);

jarRouter.route('/:jarId')
    .put(validate(updateJarSchema), updateJar)
    .delete(deleteJar);

jarRouter.post('/:jarId/deposit', validate(moneyTransactionSchema), depositToJar);
jarRouter.post('/:jarId/withdraw', validate(moneyTransactionSchema), withdrawFromJar);

export default jarRouter;