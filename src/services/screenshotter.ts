import puppeteer, { Browser } from "puppeteer";
import { PUPPETEER_LAUNCH_OPTIONS, DEFAULT_VIEWPORT, DEFAULT_TIMEOUT } from "../config/puppeteer";

export interface ScreenshotOptions{
    url: string;
    width?: number;
    height?: number;
    fullPage?: boolean;
}

export async function takeScreenshot(options: ScreenshotOptions): Promise<Buffer> {
    const {
        url,
        width = DEFAULT_VIEWPORT.width,
        height = DEFAULT_VIEWPORT.height,
        fullPage = false,
    } = options;

    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS); 

        const page = await browser.newPage();

        await page.setViewport({ width, height })

        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: DEFAULT_TIMEOUT
        })

        const screenshot = await page.screenshot({
            type: "png",
            fullPage: fullPage
        })

        return Buffer.from(screenshot);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}