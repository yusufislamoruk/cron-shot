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

export interface Schedule {
    id: string;
    user_id: string;
    url: string;
    schedule: string;
    webhook_url?: string;
    width?: number;
    height?: number;
    full_page?: boolean;
    user_agent?: string;
    authorization_header?: string;
    cookies?: string;
    active: boolean;
    last_run?: string;
    next_run?: string;
    created_at: string;
    updated_at: string;
};