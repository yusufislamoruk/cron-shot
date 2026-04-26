import { CronExpressionParser } from "cron-parser";
import { supabase } from "../config/supabase";
import { SCHEDULER_INTERVAL_MS } from "../config/scheduler";
import { takeScreenshot } from "./screenshotter";
import { uploadScreenshot } from "./uploader";
import { recordScreenshot } from "./recorder";
import { sendWebhook } from "./webhook";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function getNextRunTime(cronExpression: string): Date {
    const expr = CronExpressionParser.parse(cronExpression);
    return expr.next().toDate();
}

export async function runSchedulerTick(): Promise<void> {
    console.log("[scheduler] Running scheduler tick...");

    const { data: dueSchedules, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("active", true)
        .lte("next_run", new Date().toISOString());

    if (error) {
        console.error("[scheduler] Failed to fetch due schedules:", error);
        return;
    }

    if (!dueSchedules || dueSchedules.length === 0) {
        console.log("[scheduler] No schedules due");
        return;
    }

    console.log(`[scheduler] ${dueSchedules.length} schedule(s) due`);

    for (const schedule of dueSchedules) {
        try {
            console.log(`[scheduler] Processing schedule ${schedule.id} for ${schedule.url}`);

            const buffer = await takeScreenshot({
                url: schedule.url,
                width: schedule.width ?? 1280,
                height: schedule.height ?? 800,
                fullPage: schedule.full_page ?? true,
                userAgent: schedule.user_agent,
                authorizationHeader: schedule.authorization_header,
                cookies: schedule.cookies,
            });

            const upload = await uploadScreenshot(buffer);

            const record = await recordScreenshot({
                target_url: schedule.url,
                user_id: schedule.user_id,
                width: schedule.width ?? 1280,
                height: schedule.height ?? 800,
                full_page: schedule.full_page ?? true,
                s3_key: upload.s3_key,
                s3_url: upload.s3_url,
                user_agent: schedule.user_agent,
                authorization_header: schedule.authorization_header,
                cookies_used: !!schedule.cookies,
            });

            if (schedule.webhook_url) {
                await sendWebhook(schedule.webhook_url, {
                    screenshot_id: record.id,
                    s3_url: record.s3_url,
                    taken_at: record.taken_at,
                    target_url: record.target_url,
                });
            }

            const nextRun = getNextRunTime(schedule.schedule);

            await supabase
                .from("schedules")
                .update({
                    last_run: new Date().toISOString(),
                    next_run: nextRun.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", schedule.id);

            console.log(`[scheduler] Schedule ${schedule.id} completed. Next run: ${nextRun.toISOString()}`);
        } catch (err) {
            console.error(`[scheduler] Failed to process schedule ${schedule.id}:`, err);
        }
    }
}

export function startScheduler(): void {
    if (schedulerInterval) {
        console.log("[scheduler] Already running");
        return;
    }

    console.log(`[scheduler] Starting scheduler with ${SCHEDULER_INTERVAL_MS}ms interval`);
    schedulerInterval = setInterval(runSchedulerTick, SCHEDULER_INTERVAL_MS);

    // Run immediately on start
    runSchedulerTick();
}

export function stopScheduler(): void {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log("[scheduler] Stopped");
    }
}