import express from "express";
import cors from "cors";
import helmet from "helmet";
import screenshotRouter from "./routes/screenshot";
import schedulesRouter from "./routes/schedules";
import { clerkMiddleware } from "@clerk/express";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/screenshot", screenshotRouter);
app.use("/schedules", schedulesRouter);

export default app;