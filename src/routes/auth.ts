import { Router } from 'express';
import { validate } from "../middlewares/validate";
import {
    signup,
    login,
    verifyOtpAndLogin,
    signupSchema,
    loginSchema,
    verifyOtpSchema,
    sendOTP,
    otpSchema,
    userDetails
} from '../controllers/authController';
import { protect } from '../middlewares/auth';

const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), signup);

authRouter.post('/login', validate(loginSchema), login);

authRouter.post('/send-otp', validate(otpSchema), sendOTP);

authRouter.post('/verify-otp', validate(verifyOtpSchema), verifyOtpAndLogin);

authRouter.get('/init-details', protect, userDetails);

export default authRouter;