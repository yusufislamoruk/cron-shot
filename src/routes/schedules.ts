import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { supabase } from "../config/supabase";
import { Schedule } from "../types";
import { validateScheduleOptions } from "../validators/schedule-validator";
import { getNextRunTime } from "../utils/cron";

const router = Router();

// POST /schedules — Create a new schedule
router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const validation = validateScheduleOptions(req.body);
    if (!validation.valid || !validation.data) {
        res.status(400).json({ error: validation.error || "Invalid request body" });
        return;
    }

    const { url, schedule, webhook_url, width, height, full_page, user_agent, authorization_header, cookies } = validation.data;

    const { data: record, error } = await supabase
        .from("schedules")
        .insert({
            user_id: userId,
            url,
            schedule,
            webhook_url,
            width,
            height,
            full_page,
            user_agent,
            authorization_header,
            cookies,
            active: true,
        })
        .select()
        .single();

    if (error) {
        console.error("[schedules] Failed to create schedule:", error);
        res.status(500).json({ error: "Failed to create schedule" });
        return;
    }

    // Compute and set initial next_run
    const nextRun = getNextRunTime(schedule);
    await supabase
        .from("schedules")
        .update({ next_run: nextRun.toISOString() })
        .eq("id", record.id);

    // Refetch to get updated next_run
    const { data: updated } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", record.id)
        .single();

    res.status(201).json({ success: true, data: updated || record });
});

// GET /schedules — List user's schedules
router.get("/", async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[schedules] Failed to list schedules:", error);
        res.status(500).json({ error: "Failed to list schedules" });
        return;
    }

    res.status(200).json({ success: true, data: data || [] });
});

// GET /schedules/:id — Get single schedule
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", req.params.id)
        .eq("user_id", userId)
        .single();

    if (error || !data) {
        res.status(404).json({ error: "Schedule not found" });
        return;
    }

    res.status(200).json({ success: true, data });
});

// PATCH /schedules/:id — Update schedule
router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { data: existing } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", req.params.id)
        .eq("user_id", userId)
        .single();

    if (!existing) {
        res.status(404).json({ error: "Schedule not found" });
        return;
    }

    const updates: Partial<Schedule> = {};
    const allowed = ["url", "schedule", "webhook_url", "width", "height", "full_page", "user_agent", "authorization_header", "cookies", "active"];

    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            (updates as any)[key] = req.body[key];
        }
    }

    updates.updated_at = new Date().toISOString();

    // Recompute next_run if schedule expression changed
    const newSchedule = req.body.schedule || existing.schedule;
    if (req.body.schedule && req.body.schedule !== existing.schedule) {
        const nextRun = getNextRunTime(newSchedule);
        updates.next_run = nextRun.toISOString();
    }

    const { data, error } = await supabase
        .from("schedules")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .single();

    if (error) {
        console.error("[schedules] Failed to update schedule:", error);
        res.status(500).json({ error: "Failed to update schedule" });
        return;
    }

    res.status(200).json({ success: true, data });
});

// DELETE /schedules/:id — Delete schedule
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", req.params.id)
        .eq("user_id", userId);

    if (error) {
        console.error("[schedules] Failed to delete schedule:", error);
        res.status(500).json({ error: "Failed to delete schedule" });
        return;
    }

    res.status(200).json({ success: true, message: "Schedule deleted" });
});

export default router;