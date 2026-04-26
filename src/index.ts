import { PORT } from "./config/env";
import app from "./app";
import { startScheduler } from "./services/scheduler";

app.listen(PORT, () => {
    console.log(`CronShot backend running on port ${PORT}`);
    startScheduler();
});