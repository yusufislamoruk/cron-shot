export interface UploadResult {
    s3_key: string;
    s3_url: string;
};

export interface ScreenshotOptions {
    url: string;
    width?: number;
    height?: number;
    fullPage?: boolean;
    userAgent?: string;
    authorizationHeader?: string;
    cookies?: string;
}
export interface ScreenshotRecord {
    id: string;
    user_id: string;
    target_url: string;
    width?: number;
    height?: number;
    full_page?: boolean;
    s3_key: string;
    s3_url: string;
    taken_at: string;
    user_agent?: string;
    authorization_header?: string;
    cookies_used?: boolean;
};

export interface ScheduledJob {
    id: string;
    user_id: string;
    target_url: string;
    width: number;
    height: number;
    full_page: boolean;
    user_agent: string | null;
    authorization_header: string | null;
    cookies: string | null;
    frequency: 'daily' | 'weekly' | 'monthly';
    time_of_day: '08:00' | '13:00' | '20:00';
    next_run_at: string;
    is_active: boolean;
    created_at: string;
}