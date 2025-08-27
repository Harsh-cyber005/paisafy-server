import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
    createTransaction,
    getAllTransactions,
    getTransactionSummary,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
    transactionSchema,
    updateTransactionSchema,
    getSpendingTrend
} from '../controllers/transactionController';

const transactionRouter = Router();

transactionRouter.use(protect);

transactionRouter.route('/')
    .post(validate(transactionSchema), createTransaction)
    .get(getAllTransactions);

transactionRouter.get('/summary', getTransactionSummary);
transactionRouter.get('/spending-trend', getSpendingTrend);

transactionRouter.route('/:transactionId')
    .get(getTransactionById)
    .put(validate(updateTransactionSchema), updateTransaction)
    .delete(deleteTransaction);

export default transactionRouter;