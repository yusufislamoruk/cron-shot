import puppeteer, { Browser } from "puppeteer";
import { PUPPETEER_LAUNCH_OPTIONS, DEFAULT_VIEWPORT, DEFAULT_TIMEOUT } from "../config/puppeteer";
import { ScreenshotOptions } from "../types";
import { parseCookies } from "../utils/parseCookies";


export async function takeScreenshot(options: ScreenshotOptions): Promise<Buffer> {
    const {
        url,
        width = DEFAULT_VIEWPORT.width,
        height = DEFAULT_VIEWPORT.height,
        fullPage = false,
        userAgent,
        authorizationHeader,
        cookies
    } = options;

    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS); 

        const page = await browser.newPage();

        await page.setViewport({ width, height })

        if(userAgent){
            await page.setUserAgent(userAgent);
        }

        if (authorizationHeader){
            await page.setExtraHTTPHeaders({
                Authorization: authorizationHeader
            });
        }

        if(cookies){
            const cookieArray = parseCookies(cookies, url);
            if(cookieArray.length > 0){
                await page.browserContext().setCookie(...cookieArray);
            }
        }
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: DEFAULT_TIMEOUT
        })
        await page.waitForNavigation({waitUntil: 'networkidle2'}).catch(() =>{})
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.waitForFunction(() => document.readyState === 'complete');
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