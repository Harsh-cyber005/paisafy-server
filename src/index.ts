import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redisClient";
import authRouter from "./routes/auth";
import cors from "cors";
import userRouter from "./routes/user";
import transactionRouter from "./routes/transaction";
import goalRouter from "./routes/goal";
import chargeRouter from "./routes/charge";
import jarRouter from "./routes/jar";
import onboardingRouter from "./routes/onboarding";
import insightsRouter from "./routes/insights";

dotenv.config();
connectDB();
connectRedis();

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/goal", goalRouter);
app.use("/api/charges", chargeRouter);
app.use("/api/jars", jarRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/insights", insightsRouter);

app.get("/", (req: Request, res: Response) => {
    res.send("Hello from TypeScript Express!");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});