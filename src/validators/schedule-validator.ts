import { isValidUrl } from "./url";
import { Schedule } from "../types";

export interface ScheduleValidationResult {
    valid: boolean;
    data?: Omit<Schedule, "id" | "user_id" | "created_at" | "updated_at" | "last_run" | "next_run">;
    error?: string;
}

export function validateScheduleOptions(body: any): ScheduleValidationResult {
    const { url, schedule, webhook_url, width, height, userAgent, authorizationHeader, cookies } = body;

    if (!url) return { valid: false, error: "URL is required" };
    if (!isValidUrl(url)) return { valid: false, error: "Invalid URL format" };

    if (!schedule) return { valid: false, error: "Schedule cron expression is required" };

    // Basic cron expression validation (5 fields)
    const cronParts = schedule.trim().split(/\s+/);
    if (cronParts.length !== 5) {
        return { valid: false, error: "Invalid cron expression. Expected 5 fields: minute hour day month weekday" };
    }

    if (webhook_url && webhook_url.length > 2048) {
        return { valid: false, error: "Webhook URL is too long (max 2048 characters)" };
    }

    if (width !== undefined) {
        const w = Number(width);
        if (isNaN(w) || w < 320 || w > 3840) {
            return { valid: false, error: "Width must be a number between 320 and 3840" };
        }
    }

    if (height !== undefined) {
        const h = Number(height);
        if (isNaN(h) || h < 320 || h > 2160) {
            return { valid: false, error: "Height must be a number between 320 and 2160" };
        }
    }

    if (userAgent && userAgent.length > 500) {
        return { valid: false, error: "User agent is too long (max 500 characters)" };
    }

    if (authorizationHeader) {
        if (authorizationHeader.length > 2000) {
            return { valid: false, error: "Authorization header is too long" };
        }
        if (!authorizationHeader.startsWith("Bearer") && !authorizationHeader.startsWith("Basic")) {
            return { valid: false, error: "Authorization header must start with Bearer or Basic" };
        }
    }

    if (cookies && cookies.length > 4096) {
        return { valid: false, error: "Cookies string is too long (max 4096 characters)" };
    }

    return {
        valid: true,
        data: {
            url,
            schedule,
            webhook_url,
            width: width ? Number(width) : undefined,
            height: height ? Number(height) : undefined,
            full_page: body.fullPage === true || body.fullPage === "true",
            user_agent: userAgent,
            authorization_header: authorizationHeader,
            cookies,
            active: true,
        }
    };
}