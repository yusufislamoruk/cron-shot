import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import scheduledJobsRouter from "./routes/scheduled-jobs";
import authRouter from "./routes/auth";

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/scheduled-jobs", scheduledJobsRouter);
app.use("/auth", authRouter);
app.use("/screenshot", require("./routes/screenshot").default);

export default app;