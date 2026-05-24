import { Router, Request, Response } from "express";
import { takeScreenshot } from "../services/screenshotter";
import { validateScreenshotOptions } from "../validators/screenshot-validator";
import { errorResponse } from "../utils/response";
import { uploadScreenshot } from "../services/uploader";
import { recordScreenshot } from "../services/recorder";
import { verifyToken } from "../middleware/auth";
import { computePerceptualHash } from "../services/imageHasher";

const router = Router();

router.post("/", verifyToken, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const validation = validateScreenshotOptions(req.body);

    if(!validation.valid || !validation.data) {
        const err = errorResponse(validation.error || "Invalid request body", 400);

        res.status(400).json(err.body);
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
        const currentHash = await computePerceptualHash(buffer);

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
            perceptual_hash: currentHash,
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