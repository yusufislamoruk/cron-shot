export class ScreenshotError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = "ScreenshotError";
    }
}

export class S3UploadError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = "S3UploadError";
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}