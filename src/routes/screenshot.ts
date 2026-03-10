import { Router, Request, Response } from "express";
import { takeScreenshot } from "../services/screenshotter";
import { isValidUrl } from "../validators/url";
import { errorResponse } from "../utils/response";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { url, fullPage, width, height } = req.body;

    if (!url) {
        const err = errorResponse("url is required", 400);
        res.status(400).json(err.body);
        return;
    }

    if (!isValidUrl(url)) {
        const err = errorResponse("Invalid or unsafe URL", 400)
        res.status(400).json(err.body);
        return;
    }

    try {
        const screenshot = await takeScreenshot({ url, fullPage, width, height });

        res.set("Content-Type", "image/png");
        res.send(screenshot);
    } catch (error) {
        console.error("Screenshot attempt failed:");
        console.error(error);

        const err = errorResponse("Failed to take screenshot", 500);
        res.status(500).json(err.body);
    }
});

export default router;