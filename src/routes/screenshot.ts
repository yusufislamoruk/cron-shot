import { Router, Request, Response } from "express";
import { takeScreenshot } from "../services/screenshotter";
import { validateScreenshotOptions } from "../validators/screenshot-validator";
import { uploadScreenshot } from "../services/uploader";
import { recordScreenshot } from "../services/recorder";
import { getAuth } from "@clerk/express";
import { ScreenshotError, S3UploadError } from "../utils/errors";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(req);

    const validation = validateScreenshotOptions(req.body);

    if(!validation.valid || !validation.data) {
        res.status(400).json({ error: validation.error || "Invalid request body" });
        return;
    }

    const {url,width,height,fullPage,userAgent,authorizationHeader,cookies} = validation.data;
    try {
        const buffer = await takeScreenshot({
            url,
            fullPage: fullPage,
            width: width,
            height: height,
            userAgent: userAgent,
            authorizationHeader: authorizationHeader,
            cookies: cookies,
        });
        
        const upload = await uploadScreenshot(buffer);

        const record = await recordScreenshot({
            target_url: url,
            user_id: userId ?? "",
            width: width ?? 1280,
            height: height ?? 800,
            full_page: fullPage ?? true,
            s3_key: upload.s3_key,
            s3_url: upload.s3_url,
            user_agent: userAgent,
            authorization_header: authorizationHeader,
            cookies_used: !!cookies,
        });

        res.status(201).json({
            success: true,
            message: "Screenshot captured and stored successfully",
            data: record,
        });

    } catch (error) {
        console.error("Screenshot attempt failed:", error);

        if (error instanceof ScreenshotError) {
            res.status(502).json({ error: "Screenshot service unavailable", code: error.code });
        } else if (error instanceof S3UploadError) {
            res.status(502).json({ error: "Storage service unavailable", code: error.code });
        } else {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});

export default router;