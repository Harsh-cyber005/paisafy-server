import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { submitOnboarding, onboardingSchema } from '../controllers/onboardingController';

const onboardingRouter = Router();

onboardingRouter.use(protect);

onboardingRouter.post('/submit', validate(onboardingSchema), submitOnboarding);

export default onboardingRouter;