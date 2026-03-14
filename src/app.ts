import express from "express";
import cors from "cors";
import screenshotRouter from "./routes/screenshot";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
})

app.use("/screenshot", screenshotRouter);

export default app;