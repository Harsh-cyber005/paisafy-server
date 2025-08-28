import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
    createCharge,
    getAllCharges,
    getDues,
    updateCharge,
    markChargeAsPaid,
    deleteCharge,
    createChargeSchema,
    updateChargeSchema,
    markChargeAsNotPaid
} from '../controllers/chargeController';

const chargeRouter = Router();

chargeRouter.use(protect);

chargeRouter.route('/')
    .post(validate(createChargeSchema), createCharge)
    .get(getAllCharges);

chargeRouter.get('/dues', getDues);

chargeRouter.route('/:chargeId')
    .put(validate(updateChargeSchema), updateCharge)
    .delete(deleteCharge);

chargeRouter.patch('/:chargeId/mark-paid', markChargeAsPaid);
chargeRouter.patch('/:chargeId/mark-not-paid', markChargeAsNotPaid);

export default chargeRouter;