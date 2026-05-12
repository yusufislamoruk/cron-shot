import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import scheduledJobsRouter from "./routes/scheduled-jobs";

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/scheduled-jobs", scheduledJobsRouter);

export default app;