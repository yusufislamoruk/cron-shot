import puppeteer, { Browser, Page } from "puppeteer";
import { PUPPETEER_LAUNCH_OPTIONS, DEFAULT_VIEWPORT, DEFAULT_TIMEOUT } from "../config/puppeteer";
import { ScreenshotOptions } from "../types";
import { parseCookies } from "../utils/parseCookies";

// ─── Type definitions ────────────────────────────────────────────────────────

interface ConsentFramework {
  name: string;
  acceptSelectors: string[];
  cookiePatterns?: Array<{ name: RegExp; acceptedValue: string }>;
}

// ─── Known framework definitions ─────────────────────────────────────────────

const FRAMEWORKS: ConsentFramework[] = [
  {
    name: 'OneTrust',
    acceptSelectors: [
      '#onetrust-accept-btn-handler',
      '.onetrust-accept-btn-handler',
      '#accept-recommended-btn-handler',
    ],
    cookiePatterns: [
      { name: /OptanonAlertBoxClosed/, acceptedValue: new Date().toISOString() },
      {
        name: /OptanonConsent/,
        acceptedValue:
          'isGpcEnabled=0&datestamp=' +
          encodeURIComponent(new Date().toISOString()) +
          '&version=6.34.0&isIABGlobal=false&hosts=&consentId=&interactionCount=1&landingPath=&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1&geolocation=&AwaitingReconsent=false',
      },
    ],
  },
  {
    name: 'Cookiebot',
    acceptSelectors: [
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '#CybotCookiebotDialogBodyButtonAccept',
      '.CybotCookiebotDialogBodyButton',
    ],
    cookiePatterns: [
      {
        name: /CookieConsent/,
        acceptedValue:
          '{stamp:%27-1%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1%2Cutc:' +
          Date.now() +
          '%2Cregion:%27tr%27}',
      },
    ],
  },
  {
    name: 'TrustArc',
    acceptSelectors: ['.trustarc-agree-btn', '#truste-consent-button', '.pdynamicbutton .call'],
  },
  {
    name: 'Osano',
    acceptSelectors: ['.osano-cm-accept-all', '.osano-cm-button--type_accept'],
  },
  {
    name: 'Didomi',
    acceptSelectors: [
      '#didomi-notice-agree-button',
      '[id^="didomi-notice-agree"]',
      '.didomi-continue-without-agreeing',
    ],
    cookiePatterns: [{ name: /euconsent-v2/, acceptedValue: 'ACCEPT_ALL' }],
  },
  {
    name: 'Civic Cookie Control',
    acceptSelectors: ['#ccc-notify-accept', '#ccc-accept-button', '.ccc-notify-link'],
  },
  {
    name: 'Cookie Notice',
    acceptSelectors: ['.cn-set-cookie', '#cookie-notice-accept-button'],
  },
  {
    name: 'GDPR Cookie Consent',
    acceptSelectors: ['#cookie_action_close_header', '.gdpr-cookie-accept'],
  },
  {
    name: 'Wix',
    acceptSelectors: ['[data-testid="cookie-policy-dialog-accept-button"]'],
  },
  {
    name: 'Usercentrics',
    acceptSelectors: [
      '[data-testid="uc-accept-all-button"]',
      '#usercentrics-root', // shadow DOM — handled separately below
    ],
  },
  {
    name: 'Quantcast',
    acceptSelectors: ['.qc-cmp2-summary-buttons button:last-child', '[mode="primary"]'],
  },
  {
    name: 'Generic (cc-cookie)',
    acceptSelectors: ['.cc-btn.cc-allow', '.cc-accept', '#js-agree-btn', '.js-accept-cookies'],
  },
];

// ─── Keywords for safe text matching ─────────────────────────────────────────

const ACCEPT_KEYWORDS = [
  // Turkish
  'tümünü kabul et', 'hepsini kabul et', 'kabul et', 'kabul ediyorum',
  'tüm çerezleri kabul et', 'çerezleri kabul et',
  // English
  'accept all', 'accept all cookies', 'allow all', 'allow all cookies',
  'i accept', 'i agree', 'agree to all', 'got it', 'ok, i agree',
  'consent to all', 'yes, i accept',
  // German
  'alle akzeptieren', 'zustimmen', 'akzeptieren',
  // French
  'tout accepter', 'accepter tout', "j'accepte",
  // Spanish
  'aceptar todo', 'aceptar todas', 'acepto',
  // Italian
  'accetta tutto', 'acconsento',
  // Polish
  'zaakceptuj wszystkie', 'akceptuję',
  // Dutch
  'alles accepteren', 'accepteer alles',
];

// Never click buttons containing these strings (false-positive guard)
const NEGATIVE_KEYWORDS = [
  'manage', 'settings', 'preferences', 'customize', 'reject', 'decline',
  'ayarlar', 'tercihleri', 'reddet', 'yönet', 'özelleştir',
  'privacy policy', 'learn more', 'more info', 'details',
  'gizlilik', 'daha fazla', 'newsletter', 'subscribe', 'sign up',
  'log in', 'register', 'purchase', 'buy', 'checkout',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns true if an element matching the selector exists and is visible in
 * the viewport. Uses Puppeteer's built-in boundingBox check — if the box is
 * null the element is hidden or detached.
 */
async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    const box = await el.boundingBox();
    return box !== null && box.width > 0 && box.height > 0;
  } catch {
    return false;
  }
}

/**
 * Clicks an element inside a shadow DOM host.
 * Puppeteer cannot pierce shadow roots with normal selectors, so we drop into
 * page.evaluate and traverse the shadowRoot manually.
 */
async function clickInShadowDOM(
  page: Page,
  hostSelector: string,
  innerSelector: string
): Promise<boolean> {
  try {
    return await page.evaluate(
      (host, inner) => {
        const hostEl = document.querySelector(host);
        if (!hostEl || !hostEl.shadowRoot) return false;
        const btn = hostEl.shadowRoot.querySelector(inner) as HTMLElement | null;
        if (!btn) return false;
        btn.click();
        return true;
      },
      hostSelector,
      innerSelector
    );
  } catch {
    return false;
  }
}

// ─── Layer 1: Write consent cookies directly via CDP ─────────────────────────

/**
 * Some frameworks (OneTrust, Cookiebot) only check the presence of a consent
 * cookie. Setting it before the page renders prevents the banner from appearing
 * at all — the cleanest and fastest approach.
 *
 * Puppeteer exposes CDP via page.createCDPSession(); we use the
 * Network.setCookie command directly instead of document.cookie so the cookie
 * is set at the browser level and survives cross-origin navigations.
 */
async function trySetConsentCookiesViaCDP(page: Page, url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  const client = await page.createCDPSession();
  let count = 0;

  try {
    for (const framework of FRAMEWORKS) {
      if (!framework.cookiePatterns) continue;
      for (const pattern of framework.cookiePatterns) {
        const name = pattern.name.source.replace(/[^a-zA-Z0-9_-]/g, '');
        await client.send('Network.setCookie', {
          name,
          value: pattern.acceptedValue,
          url: origin,
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        });
        count++;
      }
    }
  } finally {
    await client.detach();
  }

  return count > 0;
}

// ─── Layer 2: Click using known framework selectors ───────────────────────────

async function tryKnownSelectors(page: Page): Promise<boolean> {
  for (const framework of FRAMEWORKS) {
    for (const selector of framework.acceptSelectors) {
      // Special case: Usercentrics renders inside a shadow root
      if (selector === '#usercentrics-root') {
        const clicked = await clickInShadowDOM(
          page,
          '#usercentrics-root',
          '[data-testid="uc-accept-all-button"]'
        );
        if (clicked) {
          console.log(`[Cookie] ${framework.name} (shadow DOM) — clicked`);
          return true;
        }
        continue;
      }

      if (await isVisible(page, selector)) {
        try {
          await page.click(selector);
          console.log(`[Cookie] ${framework.name} — selector: ${selector}`);
          return true;
        } catch {
          // This selector failed, try the next one
        }
      }
    }
  }
  return false;
}

// ─── Layer 3: Safe text-based matching ───────────────────────────────────────

async function tryTextMatching(page: Page): Promise<boolean> {
  return await page.evaluate(
    (acceptKeywords, negativeKeywords) => {
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]'
        )
      ) as HTMLElement[];

      for (const el of candidates) {
        // Skip invisible elements
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        )
          continue;

        // Skip elements hidden from assistive technology
        if (el.getAttribute('aria-hidden') === 'true') continue;

        // Normalise text content
        const text = (el.textContent ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
        if (!text || text.length > 60) continue; // Too long to be a consent button

        // Negative filter: skip buttons that look like settings/reject actions
        if (negativeKeywords.some(neg => text.includes(neg))) continue;

        // Positive match: exact or prefix match against accept keywords
        const isMatch = acceptKeywords.some(kw => text === kw || text.startsWith(kw));
        if (isMatch) {
          el.click();
          return true;
        }
      }
      return false;
    },
    ACCEPT_KEYWORDS,
    NEGATIVE_KEYWORDS
  );
}

// ─── Layer 4: Search inside iframes ──────────────────────────────────────────

/**
 * Some consent managers (e.g. TrustArc) render their banner inside a
 * cross-origin iframe. Puppeteer exposes all frames via page.frames(), so we
 * iterate them and repeat the selector search in each one.
 */
async function tryIframes(page: Page): Promise<boolean> {
  const frames = page.frames();

  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;

    try {
      for (const framework of FRAMEWORKS) {
        for (const selector of framework.acceptSelectors) {
          try {
            const el = await frame.$(selector);
            if (!el) continue;

            // Puppeteer: check visibility via boundingBox inside the frame
            const box = await el.boundingBox();
            if (!box || box.width === 0 || box.height === 0) continue;

            await el.click();
            console.log(`[Cookie] ${framework.name} — found inside iframe`);
            return true;
          } catch {
            // Selector not found in this frame, continue
          }
        }
      }
    } catch {
      // Frame is not accessible (cross-origin restriction), skip
    }
  }

  return false;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function dismissCookieBanners(
  page: Page,
  url: string,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<void> {
  const { maxRetries = 3, retryDelay = 800 } = options;

  // Brief wait for lazy-loaded or animated banners
  await sleep(600);

  // Layers 2–4: Dismiss any visible banner, with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const dismissed =
        (await tryKnownSelectors(page)) ||
        (await tryIframes(page)) ||
        (await tryTextMatching(page));

      if (dismissed) {
        await sleep(500); // Wait for close animation or redirect
        return;
      }
    } catch {
      // Unexpected error — try again on the next attempt
    }

    if (attempt < maxRetries) {
      await sleep(retryDelay);
    }
  }

  // All layers exhausted — continue silently without throwing
}

// ─── Optional: watch for dynamically injected banners ────────────────────────

/**
 * Some SPAs inject a consent banner after client-side navigation or a delayed
 * script load. This wrapper attaches a MutationObserver to the page and
 * re-runs the dismissal logic whenever the DOM changes.
 *
 * Puppeteer does not have a native "on DOM mutation" event, so we bridge the
 * observer into Node.js via page.exposeFunction + a polling fallback.
 *
 * Returns a cleanup function — call it when you no longer need the watcher.
 */
export async function watchAndDismissBanners(
  page: Page,
  url: string
): Promise<() => void> {
  let active = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const check = async () => {
    if (!active) return;
    try {
      await dismissCookieBanners(page, url, { maxRetries: 1, retryDelay: 300 });
    } catch {
      // Silent — page may have navigated away
    }
  };

  // Expose a Node.js callback that the in-page observer can call
  await page.exposeFunction('__onCookieBannerMutation', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(check, 400); // debounce rapid DOM bursts
  });

  // Install the MutationObserver in the page
  await page.evaluate(() => {
    const obs = new MutationObserver(() => {
      (window as any).__onCookieBannerMutation();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });

  // Initial run before any mutations fire
  await check();

  // Return a teardown function
  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}


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
        await trySetConsentCookiesViaCDP(page, url);

        await page.goto(url, { waitUntil: "networkidle2", timeout: DEFAULT_TIMEOUT });

        await dismissCookieBanners(page, url);
        await sleep(2000); // Wait for any animations or lazy-loaded content
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