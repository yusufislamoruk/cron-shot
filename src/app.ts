import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import screenshotRouter from "./routes/screenshot";
import { clerkMiddleware } from "@clerk/express";

const screenshotLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
        // @ts-expect-error - clerk adds auth to request
        return req.auth?.userId ?? req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" }
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/screenshot", screenshotLimiter, screenshotRouter);

export default app;