import { supabase } from "../config/supabase";
import { ScreenshotRecord } from "../types";

export const recordScreenshot = async (data: Omit<ScreenshotRecord, "id" | "taken_at">): Promise<ScreenshotRecord> => {

    const {data: record, error} = await supabase.from("screenshots")
    .insert(data)
    .select()
    .single();

    if (error) {
        console.error("[recorder] Failed to record screenshot:", error);
        throw error;
    }

    return record as ScreenshotRecord;
};
