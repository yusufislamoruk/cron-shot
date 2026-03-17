import express from "express";
import cors from "cors";
import screenshotRouter from "./routes/screenshot";
import { clerkMiddleware } from "@clerk/express";

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/screenshot", screenshotRouter);

export default app;