import { PORT } from "./config/env";
import app from "./app";

app.listen(PORT, () => {
    console.log(`CronShot backend running on port ${PORT}`);
});