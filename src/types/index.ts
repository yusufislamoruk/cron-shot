export interface UploadResult {
    s3_key: string;
    s3_url: string;
};

export interface ScreenshotRecord {
    id: string;
    user_id: string;
    target_url: string;
    width: number;
    height: number;
    full_page: boolean;
    s3_key: string;
    s3_url: string;
    taken_at: string;
};