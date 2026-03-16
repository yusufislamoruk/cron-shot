import dotenv from "dotenv";

dotenv.config();

export const PORT = Number(process.env.PORT) || 3001;

export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
export const AWS_REGION = process.env.AWS_REGION || "eu-central-1";
export const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "cron-shot-2026";

export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";