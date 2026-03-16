import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { AWS_S3_BUCKET, AWS_REGION } from "../config/env";
import { UploadResult } from "../types";
import { generateS3Key } from "../utils/storage";

export const uploadScreenshot = async (buffer: Buffer): Promise<UploadResult> => {
    const timestamp = Date.now();
    const s3Key = generateS3Key(timestamp);

    const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: "image/png",
    });

    try {
        await s3Client.send(command);

        const s3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonws.com/${s3Key}`;

        return {
            s3_key: s3Key,
            s3_url: s3Url,
        };        
    } catch (error) {
        console.error("[uploader] S3 upload failed:", error);
        throw error;
    }
};