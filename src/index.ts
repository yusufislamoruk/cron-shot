import { PORT } from "./config/env";
import { runScheduler } from "./services/scheduler";
import app from "./app";

const  start = async () => {
    const SCHEDULE_INTERVAL_MS = 60 * 1000;

    setInterval(async () => {
    await runScheduler();
    }, SCHEDULE_INTERVAL_MS);


    await runScheduler();

    app.listen(PORT, () => {
    console.log(`CronShot backend running on port ${PORT}`);
  })
};

start();
