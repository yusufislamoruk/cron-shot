import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import scheduledJobsRouter from "./routes/scheduled-jobs";

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://cron-shot-landing.vercel.app',
    'https://cron-shot-landing-git-main-yusufs-projects-fa21bcfd.vercel.app',
    'https://cron-shot-landing-4ms6nc9u5-yusufs-projects-fa21bcfd.vercel.app'
  ],
  credentials: true,
}));
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/scheduled-jobs", scheduledJobsRouter);

export default app;