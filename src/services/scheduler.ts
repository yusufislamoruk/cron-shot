import { createClient } from "@supabase/supabase-js";
import { calculateNextRunAt } from "../utils/scheduling";
import { takeScreenshot } from "./screenshotter";
import { uploadScreenshot } from "./uploader";
import { recordScreenshot } from "./recorder";
import { detectChange } from "./changeDetector";
import { computePerceptualHash } from "./imageHasher";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function runScheduler() {
    const { data: jobs, error } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('is_active', true)
        .lte('next_run_at', new Date().toISOString());

    if (error || !jobs?.length) return;

    for (const job of jobs) {
        try {
            const screenshot = await takeScreenshot({
                url: job.target_url,
                width: job.width,
                height: job.height,
                fullPage: job.full_page,
                userAgent: job.user_agent,
                authorizationHeader: job.authorization_header,
                cookies: job.cookies
            });

            const { s3_key, s3_url } = await uploadScreenshot(screenshot);
            const currentHash = await computePerceptualHash(screenshot);

            await recordScreenshot({
                user_id: job.user_id,
                target_url: job.target_url,
                width: job.width,
                height: job.height,
                full_page: job.full_page,
                s3_key,
                s3_url,
                user_agent: job.user_agent,
                authorization_header: job.authorization_header,
                cookies_used: !!job.cookies,
                perceptual_hash: currentHash
            });

            const next_run_at = calculateNextRunAt(job.frequency, job.time_of_day, job.timezone_offset);
            await supabase
                .from('scheduled_jobs')
                .update({ next_run_at: next_run_at.toISOString() })
                .eq('id', job.id);

            if (job.alert_on_change) {
                const changeResult = await detectChange(job, screenshot, s3_key);
                if (changeResult.hasChanged) {
                    console.log(`[scheduler] Change detected for job ${job.id}: ${changeResult.summary}`);
                }
            }
        } catch (err) {
            console.error(`Scheduler error for job ${job.id}:`, err);
        }
    }
}
