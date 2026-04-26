export const REQUEST_TIMEOUT_MS = 90000;

export const PUPPETEER_LAUNCH_OPTIONS = {

    headless: true,
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox"
    ]
};

export const DEFAULT_VIEWPORT = {
    width: 1280,
    height: 800,
};

export const DEFAULT_TIMEOUT = 60000;