import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db";

dotenv.config();
connectDB();

const app = express();
const PORT = 5000;

app.get("/", (req: Request, res: Response) => {
    res.send("Hello from TypeScript Express!");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});