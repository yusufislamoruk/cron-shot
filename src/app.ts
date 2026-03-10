import express from "express";
import screenshotRouter from "./routes/screenshot";

const app = express();

app.use(express.json());

app.get("/health", (_req,res) => {
    res.json({ status: "ok"});
})

app.use("/screenshot",screenshotRouter);

export default app;