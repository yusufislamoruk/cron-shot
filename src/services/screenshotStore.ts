import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { AWS_S3_BUCKET } from "../config/env";

export async function fetchPreviousScreenshot(s3Key: string | null | undefined): Promise<Buffer | null> {
    if(!s3Key) return null;

    try {
        const command = new GetObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: s3Key,
        });
        const response = await s3Client.send(command);
        const chunks: Uint8Array[] = [];

        for await ( const chunk of response.Body as AsyncIterable<Uint8Array>){
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    } catch (err) {
        console.error("[screenshotStore] Failed to fetch screenshot from S3:", err);
        return null;
    }
}