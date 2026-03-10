import app from "./app";
import { PORT } from "./config/env";

app.listen(PORT, () => {
    console.log(`CronShot backend running on port ${PORT}`);
});