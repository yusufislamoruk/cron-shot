import puppeteer, { Browser, Page, HTTPRequest } from "puppeteer";
import { PUPPETEER_LAUNCH_OPTIONS, DEFAULT_VIEWPORT, DEFAULT_TIMEOUT } from "../config/puppeteer";
import { ScreenshotOptions } from "../types";
import { parseCookies } from "../utils/parseCookies";

// ─── Type definitions ────────────────────────────────────────────────────────

interface ConsentFramework {
  name: string;
  acceptSelectors: string[];
  cookiePatterns?: Array<{ name: string; value: string }>;
  storageKeys?: Array<{ key: string; value: string }>;
}

// ─── Framework definitions ────────────────────────────────────────────────────

const FRAMEWORKS: ConsentFramework[] = [
  {
    name: 'Amazon',
    acceptSelectors: ['#sp-cc-accept', 'input[data-cel-widget="sp-cc-accept"]'],
    cookiePatterns: [{ name: 'sp-cdn', value: '"L5Z:tr"' }],
  },
  {
    name: 'OneTrust',
    acceptSelectors: ['#onetrust-accept-btn-handler', '.onetrust-accept-btn-handler'],
    cookiePatterns: [
      { name: 'OptanonAlertBoxClosed', value: new Date().toISOString() },
      { name: 'OptanonConsent', value: 'isGpcEnabled=0&interactionCount=1&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1' },
    ],
  },
  {
    name: 'Cookiebot',
    acceptSelectors: ['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '#CybotCookiebotDialogBodyButtonAccept'],
    cookiePatterns: [
      { name: 'CookieConsent', value: `{stamp:'-1',necessary:true,preferences:true,statistics:true,marketing:true,ver:1,utc:${Date.now()}}` },
    ],
  },
  {
    name: 'TrustArc',
    acceptSelectors: ['.trustarc-agree-btn', '#truste-consent-button'],
    cookiePatterns: [
      { name: 'notice_gdpr_prefs', value: '0,1,2:' },
      { name: 'notice_preferences', value: '2:' },
      { name: 'cmapi_cookie_privacy', value: 'permit 1,2,3' },
    ],
  },
  {
    name: 'Didomi',
    acceptSelectors: ['#didomi-notice-agree-button'],
    cookiePatterns: [{ name: 'euconsent-v2', value: 'ACCEPT_ALL' }],
    storageKeys: [{ key: 'didomi_consent', value: JSON.stringify({ purposes: { enabled: ['cookies', 'analytics', 'advertising'] } }) }],
  },
  {
    name: 'Osano',
    acceptSelectors: ['.osano-cm-accept-all', '.osano-cm-button--type_accept'],
    storageKeys: [{ key: 'osano_consentmanager', value: 'ACCEPT_ALL' }],
  },
  {
    name: 'Usercentrics',
    acceptSelectors: [], // shadow DOM only
    storageKeys: [{ key: 'uc_settings', value: JSON.stringify({ ccm: { version: 2, consent: true } }) }],
  },
  {
    name: 'Quantcast',
    acceptSelectors: ['.qc-cmp2-summary-buttons button:last-child'],
    cookiePatterns: [{ name: '__qca', value: 'ACCEPTED' }],
  },
  {
    name: 'Civic',
    acceptSelectors: ['#ccc-notify-accept', '#ccc-accept-button'],
    storageKeys: [{ key: 'CookieControl', value: JSON.stringify({ necessaryCookies: [], optionalCookies: { analytics: 'on', marketing: 'on' } }) }],
  },
  {
    name: 'Generic',
    acceptSelectors: [
      '.cc-btn.cc-allow', '.cc-accept',
      '#js-agree-btn', '.js-accept-cookies',
      '#cookie_action_close_header', '.gdpr-cookie-accept',
      '#cookie-notice-accept-button', '.cn-set-cookie',
      '[data-testid="cookie-policy-dialog-accept-button"]',
    ],
  },
];

// ─── URL patterns whose responses we block entirely ──────────────────────────
// These are consent-manager JS bundles. Blocking them prevents the banner
// from being injected into the DOM in the first place.

const BLOCKED_CONSENT_URLS: RegExp[] = [
  // Only block when the site doesn't need the bundle to function —
  // i.e. we've already set the cookies/storage above.
  // We block conservatively: only clear third-party consent CDNs.
  /cdn\.cookielaw\.org\/consent\//,
  /consent\.cookiebot\.com\/uc\.js/,
  /cdn\.privacy-mgmt\.com/,
  /quantcast\.mgr\.consensu\.org/,
];

// ─── Accept keywords for universal text fallback ──────────────────────────────

const ACCEPT_KEYWORDS = [
  // Turkish
  'tümünü kabul et', 'hepsini kabul et', 'kabul et', 'kabul ediyorum', 'çerezleri kabul et',
  // English
  'accept all', 'accept all cookies', 'allow all', 'allow all cookies',
  'i accept', 'i agree', 'agree to all', 'got it', 'yes, i accept',
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
  // Portuguese
  'aceitar tudo', 'aceitar todos',
  // Romanian
  'acceptați toate',
  // Czech
  'přijmout vše', 'souhlasím',
  // Swedish
  'acceptera alla', 'godkänn alla',
];

const NEGATIVE_KEYWORDS = [
  'manage', 'settings', 'preferences', 'customize', 'customise', 'reject', 'decline',
  'necessary only', 'essential only', 'refuse', 'deny',
  'ayarlar', 'tercihleri', 'reddet', 'yönet', 'özelleştir',
  'privacy policy', 'learn more', 'more info', 'cookie policy',
  'gizlilik', 'daha fazla', 'subscribe', 'sign up', 'log in', 'purchase',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function clickInShadowDOM(page: Page, hostSelector: string, innerSelector: string): Promise<boolean> {
  try {
    return await page.evaluate((host, inner) => {
      const hostEl = document.querySelector(host);
      if (!hostEl?.shadowRoot) return false;
      const btn = hostEl.shadowRoot.querySelector(inner) as HTMLElement | null;
      if (!btn) return false;
      btn.click();
      return true;
    }, hostSelector, innerSelector);
  } catch {
    return false;
  }
}

// ─── Strategy 1: Block consent manager bundles at network level ───────────────
// Intercept requests before they reach the page. If a URL matches a known
// consent CDN pattern, return an empty 200 response instead of loading the
// bundle. The banner is never injected because its JS never ran.

export function enableConsentRequestBlocking(page: Page): void {
  page.on('request', (req: HTTPRequest) => {
    const url = req.url();
    if (BLOCKED_CONSENT_URLS.some(pattern => pattern.test(url))) {
      console.log(`[Cookie] Blocked consent bundle: ${url}`);
      req.respond({ status: 200, body: '' });
    } else {
      req.continue();
    }
  });
}

// ─── Strategy 2: Set consent cookies + localStorage before navigation ─────────
// The page reads these on load and skips showing the banner entirely.
// This is the most reliable approach for framework-aware sites.

export async function injectConsentState(page: Page, url: string): Promise<void> {
  const origin = new URL(url).origin;
  const client = await page.createCDPSession();

  try {
    // Set cookies via CDP (survives cross-origin navigations)
    for (const fw of FRAMEWORKS) {
      if (!fw.cookiePatterns) continue;
      for (const { name, value } of fw.cookiePatterns) {
        await client.send('Network.setCookie', {
          name,
          value,
          url: origin,
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        });
      }
    }
  } finally {
    await client.detach();
  }

  // Pre-populate localStorage/sessionStorage via page script injection.
  // We use Page.addScriptToEvaluateOnNewDocument so it runs before any
  // site JS — the consent flag is already there when the site checks for it.
  const storageScript = FRAMEWORKS
    .flatMap(fw => fw.storageKeys ?? [])
    .map(({ key, value }) =>
      `try { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)}); } catch(e) {}`
    )
    .join('\n');

  if (storageScript) {
    await page.evaluateOnNewDocument(storageScript);
  }
}

// ─── Strategy 3: waitForSelector race — click the first visible button ────────
// Unlike a blind sleep(), this waits precisely until a banner element appears
// and immediately acts. Times out gracefully if no banner shows up.

async function tryKnownSelectors(page: Page, timeoutMs = 4000): Promise<boolean> {
  const allSelectors = FRAMEWORKS.flatMap(fw => fw.acceptSelectors).filter(Boolean);

  // Race all selectors simultaneously — first one wins
  const winner = await Promise.race([
    ...allSelectors.map(selector =>
      page.waitForSelector(selector, { visible: true, timeout: timeoutMs })
        .then(() => selector)
        .catch(() => null)
    ),
    sleep(timeoutMs).then(() => null),
  ]);

  if (!winner) return false;

  try {
    // Extra visibility check before clicking
    if (!(await isVisible(page, winner))) return false;
    await page.click(winner);
    console.log(`[Cookie] Clicked known selector: ${winner}`);
    return true;
  } catch {
    return false;
  }
}

// ─── Strategy 4: Usercentrics shadow DOM ─────────────────────────────────────

async function tryUsercentricsShawdowDOM(page: Page): Promise<boolean> {
  return clickInShadowDOM(page, '#usercentrics-root', '[data-testid="uc-accept-all-button"]');
}

// ─── Strategy 5: iframe search ────────────────────────────────────────────────

async function tryIframes(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      for (const fw of FRAMEWORKS) {
        for (const selector of fw.acceptSelectors) {
          try {
            const el = await frame.$(selector);
            if (!el) continue;
            const box = await el.boundingBox();
            if (!box || box.width === 0) continue;
            await el.click();
            console.log(`[Cookie] Clicked in iframe: ${selector}`);
            return true;
          } catch { /* continue */ }
        }
      }
    } catch { /* cross-origin frame, skip */ }
  }
  return false;
}

// ─── Strategy 6: Universal text matching (last resort) ────────────────────────
// Scans all visible interactive elements for accept-like text.
// Negative keyword filter prevents clicking settings/reject buttons.

async function tryTextMatching(page: Page): Promise<boolean> {
  return page.evaluate((acceptKws, negativeKws) => {
    const candidates = Array.from(document.querySelectorAll(
      'button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]'
    )) as HTMLElement[];

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;

      // Must be inside a dialog/banner-like container to avoid clicking
      // unrelated "agree" buttons elsewhere on the page
      const isInsideBanner = el.closest([
        '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]',
        '[class*="banner"]', '[class*="notice"]', '[class*="modal"]',
        '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]',
        '[role="dialog"]', '[role="alertdialog"]',
      ].join(',')) !== null;

      if (!isInsideBanner) continue;

      const text = (el.textContent ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (!text || text.length > 80) continue;
      if (negativeKws.some(kw => text.includes(kw))) continue;
      if (acceptKws.some(kw => text === kw || text.startsWith(kw))) {
        el.click();
        return true;
      }
    }
    return false;
  }, ACCEPT_KEYWORDS, NEGATIVE_KEYWORDS);
}

// ─── Main dismiss function ────────────────────────────────────────────────────

export async function dismissCookieBanners(
  page: Page,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<void> {
  const { maxRetries = 3, retryDelay = 600 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const dismissed =
        (await tryKnownSelectors(page, 3000)) ||
        (await tryUsercentricsShawdowDOM(page)) ||
        (await tryIframes(page)) ||
        (await tryTextMatching(page));

      if (dismissed) {
        await sleep(400);
        return;
      }
    } catch { /* unexpected error — retry */ }

    if (attempt < maxRetries) await sleep(retryDelay);
  }
}

// ─── Optional: MutationObserver watcher for SPA route changes ─────────────────

export async function watchAndDismissBanners(page: Page): Promise<() => void> {
  let active = true;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const check = async () => {
    if (!active) return;
    try { await dismissCookieBanners(page, { maxRetries: 1, retryDelay: 200 }); } catch { /* silent */ }
  };

  await page.exposeFunction('__cookieBannerMutation', () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(check, 350);
  });

  await page.evaluate(() => {
    new MutationObserver(() => (window as any).__cookieBannerMutation())
      .observe(document.body, { childList: true, subtree: true });
  });

  await check();

  return () => {
    active = false;
    if (debounce) clearTimeout(debounce);
  };
}

// ─── Screenshot function ──────────────────────────────────────────────────────

export async function takeScreenshot(options: ScreenshotOptions): Promise<Buffer> {
  const {
    url,
    width = DEFAULT_VIEWPORT.width,
    height = DEFAULT_VIEWPORT.height,
    fullPage = false,
    userAgent,
    authorizationHeader,
    cookies,
  } = options;

  let browser: Browser | undefined;

  try {
    browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
    const page = await browser.newPage();

    // Enable request interception for consent bundle blocking
    await page.setRequestInterception(true);
    enableConsentRequestBlocking(page);

    await page.setViewport({ width, height });

    if (userAgent) await page.setUserAgent(userAgent);
    if (authorizationHeader) {
      await page.setExtraHTTPHeaders({ Authorization: authorizationHeader });
    }
    if (cookies) {
      const cookieArray = parseCookies(cookies, url);
      if (cookieArray.length > 0) await page.browserContext().setCookie(...cookieArray);
    }

    // Strategy 1+2: inject consent state BEFORE navigation
    await injectConsentState(page, url);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });

    // Strategies 3–6: dismiss any banner that still appeared
    await dismissCookieBanners(page);

    await page.waitForFunction(() => document.readyState === 'complete');
    await sleep(1000); // final settle for lazy-loaded content

    const screenshot = await page.screenshot({ type: 'png', fullPage });
    return Buffer.from(screenshot);
  } finally {
    if (browser) await browser.close();
  }
}