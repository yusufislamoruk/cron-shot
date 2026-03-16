import { Router, Request, Response } from "express";
import { takeScreenshot } from "../services/screenshotter";
import { isValidUrl } from "../validators/url";
import { errorResponse } from "../utils/response";
import { uploadScreenshot } from "../services/uploader";
import { recordScreenshot } from "../services/recorder";

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
        const buffer = await takeScreenshot({
            url,
            fullPage: fullPage ?? true,
            width: width ?? 1280,
            height: height ?? 800,
        });
        
        const upload = await uploadScreenshot(buffer);

        const record = await recordScreenshot({
            target_url: url,
            width: width ?? 1280,
            height: height ?? 800,
            full_page: fullPage ?? true,
            s3_key: upload.s3_key,
            s3_url: upload.s3_url,
        });

        res.status(201).json({
            success: true,
            message: "Screenshot captured and stored successfully",
            data: record,
        });

    } catch (error) {
        console.error("Screenshot attempt failed:");
        console.error(error);

        const err = errorResponse("Failed to take screenshot", 500);
        res.status(500).json(err.body);
    }
});

export default router;