import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { takeScreenshot } from "../services/screenshotter";
import { validateScreenshotOptions } from "../validators/screenshot-validator";
import { errorResponse } from "../utils/response";
import { uploadScreenshot } from "../services/uploader";
import { recordScreenshot } from "../services/recorder";
import { verifyToken } from "../middleware/auth";
import { computePerceptualHash } from "../services/imageHasher";
import { s3Client } from "../config/s3";
import { AWS_S3_BUCKET } from "../config/env";

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); 

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

router.delete("/:id", verifyToken, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: screenshot, error: fetchError} = await supabase
        .from("screenshots")
        .select("s3_key, user_id")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

    if (fetchError || !screenshot) {
        res.status(404).json({ error: "Screenshot not found"});
        return;
    }

    if (screenshot.s3_key) {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: screenshot.s3_key
        }));
    }

    const {error: deleteError} = await supabase
        .from("screenshots")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (deleteError) {
        res.status(500).json({ error: deleteError.message || "Failed to delete screenshot"});
        return;
    }

    res.json({ success: true});
});

export default router;