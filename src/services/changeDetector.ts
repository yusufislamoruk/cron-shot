import { supabase } from '../config/supabase';
import { computePerceptualHash, imagesAreSimilar } from './imageHasher';
import { analyzeChangeWithAI } from './aiAnalyzer';
import { sendChangeAlert } from './emailService';
import { fetchPreviousScreenshot } from './screenshotStore';
import { ScheduledJob } from '../types';

interface ChangeDetectionResult {
    hasChanged: boolean;
    summary?: string;
}

export async function detectChange(
    job: ScheduledJob,
    currentBuffer: Buffer,
    currentS3Key: string,
    currentS3Url: string
): Promise<ChangeDetectionResult> {
    if (!job.alert_on_change) {
        return { hasChanged: false };
    }

    const currentHash = await computePerceptualHash(currentBuffer);

    if (job.last_screenshot_hash) {
        const isSimilar = imagesAreSimilar(currentHash, job.last_screenshot_hash);
        if (isSimilar) {
            return { hasChanged: false };
        }
    }

    let summary: string | undefined;

    try {
        const previousBuffer = await fetchPreviousScreenshot(job.last_screenshot_key);
        summary = await analyzeChangeWithAI(previousBuffer, currentBuffer, job.target_url);
    } catch (err) {
        console.error('[changeDetector] AI analysis failed:', err);
        summary = 'A change was detected on your tracked webpage, but AI analysis failed. Please check the screenshot manually.';
    }

    if (job.user_email) {
        await sendChangeAlert({
            to: job.user_email,
            jobId: job.id,
            targetUrl: job.target_url,
            summary,
            screenshotUrl: currentS3Url,
        });
    }

    await supabase
        .from('scheduled_jobs')
        .update({
            last_screenshot_hash: currentHash,
            last_screenshot_key: currentS3Key,
            last_notified_at: new Date().toISOString(),
        })
        .eq('id', job.id);

    return { hasChanged: true, summary };
}
