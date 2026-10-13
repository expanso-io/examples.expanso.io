import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium, type Browser, type Page } from '@playwright/test';

let browser: Browser;
let bundle: string;
let throwingSdkBundle: string;
// The test page script. posthogPath is the module that import('posthog-js')
// loads in it.
async function buildBundle(posthogPath: string): Promise<string> {
  return (
    await build({
      alias: { 'posthog-js': posthogPath },
      stdin: {
        contents: `import * as analytics from './src/lib/analytics';
      import * as events from './src/analytics/events';
      import * as routes from './src/clientModules/posthog';
      import * as google from './src/lib/googleAnalytics';
      import * as consent from './src/components/cookies/cookieConsentUtils';
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import CookieConsentCard from './src/components/cookies/CookieConsentCard';
      window.testAnalytics = {...analytics, ...events, ...routes, ...google, ...consent};
      // The real banner, so the tests click its buttons, not a copy of them.
      window.mountCard = () => createRoot(document.body.appendChild(document.createElement('div'))).render(React.createElement(CookieConsentCard));`,
        resolveDir: process.cwd(),
      },
      // The card's CSS module goes to a separate output that the tests do
      // not load; esbuild needs an output path for it even with write: false.
      loader: { '.css': 'local-css' },
      outdir: 'collector-bundle',
      jsx: 'automatic',
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      // The production variant is the one with delivery code; every external
      // request is still aborted below so nothing reaches an analytics host.
      define: { 'process.env.EXPANSO_PRODUCTION_ANALYTICS': '"1"' },
    })
  ).outputFiles.find((file) => file.path.endsWith('.js'))!.text;
}
before(async () => {
  bundle = await buildBundle(
    createRequire(import.meta.url).resolve('posthog-js')
  );
  // A stand-in SDK whose init throws, as posthog-js can when a blocker or
  // locked-down storage breaks it.
  throwingSdkBundle = await buildBundle(
    fileURLToPath(new URL('./fixtures/throwing-posthog.ts', import.meta.url))
  );
  browser = await chromium.launch({
    headless: true,
  });
});
after(async () => {
  await browser?.close();
});

type Receipt = { event: string; properties: Record<string, any> };
// Events the SDK sends by itself with docs' capture settings. Heatmap batches
// flush on a timer and $pageleave goes out on unload, so they can land in any
// test. They go to their own list, so the counts a test checks stay exact.
// $exception is off in the project today, but the code no longer disables it.
const IMPLICIT_EVENTS = new Set([
  '$pageleave',
  '$autocapture',
  '$web_vitals',
  '$$heatmap',
  '$snapshot',
  '$dead_click',
  '$rageclick',
  '$exception',
]);
// The part of the PostHog project's remote config these tests need. The SDK
// starts autocapture only after the project says it allows it.
const REMOTE_CONFIG = { autocapture_opt_out: false };
async function journey(
  options: {
    consent?: boolean;
    hostOnlyConsent?: boolean;
    geo?: 'eu' | 'row';
    host?: string;
    internal?: boolean;
    query?: string;
    referrer?: string;
    // Another test page script, such as throwingSdkBundle.
    bundle?: string;
    // Like Safari's "Block all cookies": cookie writes vanish and
    // localStorage throws.
    blockStorage?: boolean;
  } = {}
) {
  const context = await browser.newContext();
  const host = options.host ?? 'examples.expanso.io';
  // Expanso sites share the choice on .expanso.io. The contract deletes a
  // host-only copy on *.expanso.io, so only hostOnlyConsent seeds one.
  if (options.consent !== undefined)
    await context.addCookies([
      {
        name: 'expanso-cookie-consent',
        value: String(options.consent),
        domain: options.hostOnlyConsent ? host : '.expanso.io',
        path: '/',
      },
    ]);
  // The docs-geo Worker sets this host-only cookie; without it, readGeo says eu.
  if (options.geo)
    await context.addCookies([
      { name: 'expanso-geo', value: options.geo, domain: host, path: '/' },
    ]);
  const receipts: Receipt[] = [];
  const implicit: Receipt[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === host) {
      await route.fulfill({
        contentType: 'text/html',
        body: `<html><title>Analytics test</title><script>${(options.bundle ?? bundle).replaceAll('</script', '<\\/script')}</script></html>`,
      });
    } else if (url.hostname === 'web.t.expanso.io') {
      if (/^\/array\/phc_\w+\/config$/.test(url.pathname))
        return route.fulfill({ json: REMOTE_CONFIG });
      const body = route.request().postDataBuffer();
      if (body && url.pathname.includes('/e/')) {
        const decoded =
          body[0] === 0x1f && body[1] === 0x8b
            ? gunzipSync(body).toString()
            : body.toString();
        // $pageleave goes out on unload by sendBeacon, as data=<base64 JSON>.
        const parsed = JSON.parse(
          decoded.startsWith('data=')
            ? Buffer.from(
                new URLSearchParams(decoded).get('data') ?? '',
                'base64'
              ).toString()
            : decoded
        );
        // posthog-js 1.435 sends { api_key, batch: [...] }; older SDKs send an array.
        const batch: Receipt[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.batch)
            ? parsed.batch
            : [parsed];
        for (const receipt of batch)
          (IMPLICIT_EVENTS.has(receipt.event) ? implicit : receipts).push(
            receipt
          );
      }
      await route.fulfill({ contentType: 'application/json', body: '{}' });
    } else await route.abort(); // No Google, external config or live ingestion.
  });
  const page = await context.newPage();
  // A script error fails no request, so the tests that break the SDK or the
  // storage check this list.
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Method syntax on purpose: tsx wraps arrow functions in object literals in
  // a __name() helper, which does not exist in the page.
  if (options.blockStorage)
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get() {
          return '';
        },
        set() {},
      });
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
  if (options.internal)
    await page.addInitScript(() =>
      localStorage.setItem('expanso_analytics_internal', 'true')
    );
  await page.goto(`https://${host}/${options.query ?? ''}`, {
    referer: options.referrer,
  });
  await prepare(page);
  return { context, page, receipts, implicit, errors };
}
async function prepare(page: Page) {
  await page.evaluate(async () => {
    const sdk = await (window as any).testAnalytics.initializeAnalytics();
    sdk?.set_config({ request_batching: false });
  });
}
async function waitForCount(receipts: Receipt[], count: number) {
  for (let i = 0; i < 100 && receipts.length < count; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(receipts.length, count);
}
async function view(page: Page, pathname = '/', previous?: string) {
  await page.evaluate(
    ({ pathname, previous }) => {
      if (location.pathname !== pathname) history.pushState({}, '', pathname);
      (window as any).testAnalytics.onRouteDidUpdate({
        location: { pathname },
        previousLocation:
          previous === undefined ? undefined : { pathname: previous },
      });
    },
    { pathname, previous }
  );
}
// Consent changes add a lane $pageview and cookie_consent, so tests that
// change consent wait per event name, not for a total count.
async function waitForEvents(
  receipts: Receipt[],
  event: string,
  count: number
) {
  const matching = () => receipts.filter((receipt) => receipt.event === event);
  for (let i = 0; i < 100 && matching().length < count; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(matching().length, count);
  return matching();
}
function persistentKeys(page: Page) {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('ph_'))
  );
}
// Everything the SDK could keep about a visitor in this browser.
async function storedIdentity(page: Page) {
  const storage = await page.evaluate(() => ({
    localStorage: Object.keys(localStorage).filter(
      (key) => key.startsWith('ph_') || key.startsWith('__ph_opt_in_out_')
    ),
    sessionStorage: Object.keys(sessionStorage).filter((key) =>
      key.startsWith('ph_')
    ),
  }));
  const cookies = (await page.context().cookies())
    .filter((cookie) => cookie.name.startsWith('ph_'))
    .map((cookie) => `${cookie.name}@${cookie.domain}`);
  return { cookies, ...storage };
}
const NOTHING_STORED = { cookies: [], localStorage: [], sessionStorage: [] };
// The SDK writes its cookie a moment after the first event, so poll for it.
async function hasSharedIdentityCookie(page: Page) {
  for (let i = 0; i < 100; i++) {
    const { cookies } = await storedIdentity(page);
    if (
      cookies.some((cookie) =>
        /^ph_phc_\w+_posthog@\.expanso\.io$/.test(cookie)
      )
    )
      return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

test('validated semantic events reach the real SDK request boundary once with unchanged dataLayer schema', async () => {
  const { context, page, receipts } = await journey({
    query:
      '?utm_source=qa&utm_campaign=launch&utm_term=edge-data&email=private%40example.test&analytics_test=1#secret',
    internal: true,
    referrer: 'https://www.google.com/search?q=private-search',
  });
  try {
    await page.evaluate(() => {
      const a = (window as any).testAnalytics;
      for (const event of [
        a.createExampleViewEvent(
          'remove-pii',
          'offline-runnable',
          'not-assessed'
        ),
        a.createExplorerStageChangeEvent(
          'remove-pii',
          'hash-email',
          'keyboard'
        ),
        a.createExplorerViewChangeEvent('remove-pii', 'changes'),
        a.createExplorerCopyEvent('remove-pii', 'hash-email', 'output'),
        a.createPipelineDownloadEvent('remove-pii', 'hash-email', 'full'),
        a.createExplorerShareEvent('remove-pii', 'hash-email'),
        a.createExampleFilterChangeEvent('goal', ['secure-data'], 4),
        a.createExampleSearchEvent(12, 3),
      ])
        a.recordAnalyticsEvent(event);
    });
    await waitForCount(receipts, 8);
    const layer = (await page.evaluate(() => window.dataLayer)) as Record<
      string,
      unknown
    >[];
    assert.equal(layer.length, 8);
    assert.equal(new Set(receipts.map((receipt) => receipt.event)).size, 8);
    for (const receipt of receipts) {
      const original = layer.find((event) => event.event === receipt.event)!;
      for (const [key, value] of Object.entries(original))
        if (key !== 'event') assert.deepEqual(receipt.properties[key], value);
      assert.equal(receipt.properties.site_id, 'examples');
      assert.equal(receipt.properties.site_host, 'examples.expanso.io');
      assert.equal(receipt.properties.environment, 'production');
      assert.equal(receipt.properties.analytics_schema_version, '2026-09-08');
      assert.equal(receipt.properties.consent_state, 'unset');
      assert.equal(receipt.properties.identity_mode, 'ephemeral');
      assert.equal(receipt.properties.is_synthetic, true);
      assert.equal(receipt.properties.is_internal, true);
      assert.equal(
        receipt.properties.$referrer,
        'https://www.google.com/search'
      );
      assert.equal(receipt.properties.$referring_domain, 'www.google.com');
      assert.equal(receipt.properties.utm_source, 'qa');
      assert.equal(receipt.properties.utm_term, 'edge-data');
      assert.equal(receipt.properties.traffic_class, 'known_automation');
      assert.equal(receipt.properties.traffic_classifier_version, '2026-09-08');
    }
    assert.doesNotMatch(
      JSON.stringify(receipts),
      /private|secret|email=|#secret/
    );
    assert.deepEqual(await persistentKeys(page), []);
    await view(page, '/next/', '/');
    await waitForCount(receipts, 9);
    assert.equal(receipts[8].properties.utm_campaign, 'launch');
    assert.equal(receipts[8].properties.is_synthetic, true);
  } finally {
    await context.close();
  }
});

test('manual route owner emits initial and SPA/back views once, ignoring query/hash changes', async () => {
  const { context, page, receipts } = await journey();
  try {
    assert.equal(receipts.length, 0); // SDK initialization has no automatic pageview.
    // Compression makes concurrent request arrival order nondeterministic.
    // Verify each route's receipt before triggering the following navigation.
    await view(page);
    await waitForCount(receipts, 1);
    await view(page, '/next/', '/');
    await waitForCount(receipts, 2);
    await view(page, '/next/', '/next/');
    await view(page, '/', '/next/');
    await waitForCount(receipts, 3);
    assert.deepEqual(
      receipts.map((r) => r.properties.page_path),
      ['/', '/next/', '/']
    );
    assert.ok(receipts.every((r) => r.event === '$pageview'));
  } finally {
    await context.close();
  }
});

test('an EU visitor without a choice is counted cookieless, with nothing stored', async () => {
  for (const geo of [undefined, 'eu'] as const) {
    const { context, page, receipts } = await journey({ geo });
    try {
      await view(page);
      await view(page, '/next/', '/');
      await waitForCount(receipts, 2);
      for (const receipt of receipts) {
        assert.equal(receipt.properties.consent_state, 'unset');
        assert.equal(receipt.properties.identity_mode, 'ephemeral');
        assert.equal(receipt.properties.$cookieless_mode, true);
      }
      await page.waitForTimeout(500); // Longer than the SDK's cookie write delay.
      assert.deepEqual(await storedIdentity(page), NOTHING_STORED);
    } finally {
      await context.close();
    }
  }
});

test('a visitor outside the EU without a choice gets the shared identity cookie', async () => {
  const { context, page, receipts } = await journey({ geo: 'row' });
  try {
    await view(page);
    await view(page, '/next/', '/');
    await waitForCount(receipts, 2);
    for (const receipt of receipts) {
      assert.equal(receipt.properties.consent_state, 'unset');
      assert.equal(receipt.properties.identity_mode, 'persistent');
    }
    assert.equal(
      receipts[0].properties.distinct_id,
      receipts[1].properties.distinct_id
    );
    assert.ok(await hasSharedIdentityCookie(page));
  } finally {
    await context.close();
  }
});

test('accepting in the EU moves to the persistent lane with its own page view, kept on reload', async () => {
  const { context, page, receipts } = await journey({ geo: 'eu' });
  try {
    await view(page);
    await waitForEvents(receipts, '$pageview', 1);
    await page.evaluate(() =>
      (window as any).testAnalytics.setCookieConsent('yes')
    );
    const views = await waitForEvents(receipts, '$pageview', 2);
    assert.equal(views[1].properties.identity_mode, 'persistent');
    assert.equal(views[1].properties.consent_state, 'granted');
    assert.equal(views[1].properties.page_path, '/');
    const grantedId = views[1].properties.distinct_id;
    assert.ok(await hasSharedIdentityCookie(page));
    await page.reload();
    await prepare(page);
    await view(page);
    const reloaded = await waitForEvents(receipts, '$pageview', 3);
    assert.equal(reloaded[2].properties.identity_mode, 'persistent');
    assert.equal(reloaded[2].properties.distinct_id, grantedId);
  } finally {
    await context.close();
  }
});

test('declining after accepting moves to the cookieless lane and clears the stored identity', async () => {
  const { context, page, receipts } = await journey({ consent: true });
  try {
    await view(page);
    const [accepted] = await waitForEvents(receipts, '$pageview', 1);
    assert.equal(accepted.properties.identity_mode, 'persistent');
    assert.ok(await hasSharedIdentityCookie(page));
    // What the banner's Decline button does.
    await page.evaluate(() => {
      const a = (window as any).testAnalytics;
      a.setCookieConsent('no');
      a.captureConsentChoice(a.consentEvidenceClient, 'no', 'banner');
    });
    const views = await waitForEvents(receipts, '$pageview', 2);
    const [choice] = await waitForEvents(receipts, 'cookie_consent', 1);
    for (const receipt of [views[1], choice]) {
      assert.equal(receipt.properties.identity_mode, 'ephemeral');
      assert.equal(receipt.properties.consent_state, 'denied');
      assert.notEqual(
        receipt.properties.distinct_id,
        accepted.properties.distinct_id
      );
    }
    assert.equal(choice.properties.consent, 'no');
    assert.equal(choice.properties.method, 'banner');
    assert.equal(choice.properties.scope, 'analytics');
    assert.equal(choice.properties.site_id, 'examples');
    await page.waitForTimeout(500); // Longer than the SDK's cookie write delay.
    const stored = await storedIdentity(page);
    assert.deepEqual(stored.cookies, []);
    assert.deepEqual(await persistentKeys(page), []);
    assert.deepEqual(stored.sessionStorage, []);
  } finally {
    await context.close();
  }
});

test('a visitor who accepted on another Expanso site is persistent from the first page view', async () => {
  const { context, page, receipts } = await journey({ consent: true });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    assert.equal(receipts[0].properties.consent_state, 'granted');
    assert.equal(receipts[0].properties.identity_mode, 'persistent');
    assert.ok(await hasSharedIdentityCookie(page));
  } finally {
    await context.close();
  }
});

test('closing the banner sends cookie_banner_dismissed through capture, and nothing else passes', async () => {
  const { context, page, receipts } = await journey();
  try {
    await view(page);
    await waitForEvents(receipts, '$pageview', 1);
    // What the banner's close button does for an undecided visitor.
    await page.evaluate(() => {
      const a = (window as any).testAnalytics;
      a.consentEvidenceClient.capture('$pageview', { page_path: '/other/' });
      a.dismissConsentBanner(a.consentEvidenceClient, 'banner');
    });
    const [closed] = await waitForEvents(
      receipts,
      'cookie_banner_dismissed',
      1
    );
    assert.equal(closed.properties.method, 'banner');
    assert.equal(closed.properties.scope, 'analytics');
    assert.equal(closed.properties.site_id, 'examples');
    assert.equal(closed.properties.consent_state, 'unset');
    assert.equal(closed.properties.identity_mode, 'ephemeral');
    await page.waitForTimeout(300); // A leaked event would arrive by now.
    // The evidence client passes only the contract's two consent events.
    assert.deepEqual(
      receipts.map((receipt) => receipt.event),
      ['$pageview', 'cookie_banner_dismissed']
    );
  } finally {
    await context.close();
  }
});

test('the real banner buttons send the evidence events with the banner source', async () => {
  const card = 'section[aria-label="Analytics privacy choices"]';
  for (const [button, event, consent, state, mode] of [
    ['Accept analytics', 'cookie_consent', 'yes', 'granted', 'persistent'],
    ['Decline analytics', 'cookie_consent', 'no', 'denied', 'ephemeral'],
    ['Close', 'cookie_banner_dismissed', undefined, 'unset', 'ephemeral'],
  ] as const) {
    const { context, page, receipts } = await journey({ geo: 'eu' });
    try {
      await view(page);
      await waitForEvents(receipts, '$pageview', 1);
      await page.evaluate(() => (window as any).mountCard());
      await page.locator(card).getByRole('button', { name: button }).click();
      await page.locator(card).waitFor({ state: 'detached' });
      const [evidence] = await waitForEvents(receipts, event, 1);
      assert.equal(evidence.properties.consent, consent);
      assert.equal(evidence.properties.method, 'banner');
      assert.equal(evidence.properties.scope, 'analytics');
      assert.equal(evidence.properties.site_id, 'examples');
      assert.equal(evidence.properties.consent_state, state);
      assert.equal(evidence.properties.identity_mode, mode);
      assert.equal(
        await page.evaluate(() => (window as any)['ga-disable-G-6YXD85WVC6']),
        button !== 'Accept analytics'
      );
      if (button === 'Accept analytics') {
        // One click moves an EU visitor to the persistent lane, with a page
        // view of its own and the shared identity cookie.
        const views = await waitForEvents(receipts, '$pageview', 2);
        assert.equal(views[1].properties.identity_mode, 'persistent');
        assert.equal(views[1].properties.consent_state, 'granted');
        assert.ok(await hasSharedIdentityCookie(page));
      }
    } finally {
      await context.close();
    }
  }
});

test('with cookies and storage blocked, Accept leaves the card open and the SDK cookieless', async () => {
  const card = 'section[aria-label="Analytics privacy choices"]';
  const { context, page, receipts, errors } = await journey({
    blockStorage: true,
  });
  try {
    await view(page);
    const [first] = await waitForEvents(receipts, '$pageview', 1);
    assert.equal(first.properties.$cookieless_mode, true);
    assert.equal(first.properties.identity_mode, 'ephemeral');
    await page.evaluate(() => (window as any).mountCard());
    const accept = page
      .locator(card)
      .getByRole('button', { name: 'Accept analytics' });
    await accept.click();
    await accept.click();
    // The browser drops the consent cookie, so the choice never lands: the
    // card stays open, and each click sends its evidence again, cookieless.
    const choices = await waitForEvents(receipts, 'cookie_consent', 2);
    assert.ok(await page.locator(card).isVisible());
    for (const choice of choices) {
      assert.equal(choice.properties.consent, 'yes');
      assert.equal(choice.properties.consent_state, 'unset');
      assert.equal(choice.properties.identity_mode, 'ephemeral');
    }
    assert.equal(
      await page.evaluate(() => (window as any)['ga-disable-G-6YXD85WVC6']),
      true
    );
    await page.waitForTimeout(300); // A lane page view would arrive by now.
    assert.equal(
      receipts.filter((receipt) => receipt.event === '$pageview').length,
      1
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('GA follows a consent change that does not move the PostHog lane', async () => {
  const { context, page, receipts } = await journey({ geo: 'row' });
  try {
    await view(page);
    await waitForEvents(receipts, '$pageview', 1);
    const gaDisabled = () =>
      page.evaluate(() => (window as any)['ga-disable-G-6YXD85WVC6']);
    assert.equal(await gaDisabled(), true); // Undecided: GA stays off.
    // Outside the EU an undecided visitor is already in the persistent lane,
    // so accepting sends no lane page view. GA must still turn on.
    await page.evaluate(() =>
      (window as any).testAnalytics.setCookieConsent('yes')
    );
    assert.equal(await gaDisabled(), false);
    await page.evaluate(() =>
      (window as any).testAnalytics.setCookieConsent('no')
    );
    assert.equal(await gaDisabled(), true);
  } finally {
    await context.close();
  }
});

test('GA follows consent when the PostHog SDK fails to initialize', async () => {
  const { context, page, receipts, errors } = await journey({
    bundle: throwingSdkBundle,
  });
  try {
    await view(page);
    await page.waitForTimeout(500); // A request would arrive by now.
    assert.deepEqual(receipts, []);
    const gaDisabled = () =>
      page.evaluate(() => (window as any)['ga-disable-G-6YXD85WVC6']);
    assert.equal(await gaDisabled(), true); // Undecided: GA stays off.
    // The real card, with no SDK behind it.
    await page.evaluate(() => (window as any).mountCard());
    const card = page.locator(
      'section[aria-label="Analytics privacy choices"]'
    );
    await card.getByRole('button', { name: 'Accept analytics' }).click();
    await card.waitFor({ state: 'detached' });
    assert.equal(await gaDisabled(), false);
    // What the footer's Cookie settings button does, then Decline.
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('cookie_consent_open'))
    );
    await card.getByRole('button', { name: 'Decline analytics' }).click();
    await card.waitFor({ state: 'detached' });
    assert.equal(await gaDisabled(), true);
    await page.waitForTimeout(300); // A request would arrive by now.
    assert.deepEqual(receipts, []);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('autocapture runs like docs, with element text and before_send cleaning', async () => {
  const { context, page, receipts, implicit } = await journey({
    query: '?email=private%40example.test&gclid=private-click-id#secret',
  });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.textContent = 'Copy pipeline';
      document.body.append(button);
    });
    await page.click('button');
    const [click] = await waitForEvents(implicit, '$autocapture', 1);
    assert.equal(click.properties.$event_type, 'click');
    assert.equal(click.properties.$el_text, 'Copy pipeline');
    assert.equal(click.properties.$current_url, 'https://examples.expanso.io/');
    assert.equal(click.properties.identity_mode, 'ephemeral');
    assert.equal(click.properties.$cookieless_mode, true);
    // before_send gives it the context of examples' own events.
    for (const key of [
      'site_id',
      'site_host',
      'environment',
      'analytics_schema_version',
      'consent_state',
      'traffic_class',
      'traffic_classifier_version',
      'is_synthetic',
      'is_internal',
    ])
      assert.equal(click.properties[key], receipts[0].properties[key], key);
    assert.equal(click.properties.site_id, 'examples');
    assert.doesNotMatch(JSON.stringify(click), /private|secret/);
    assert.equal(receipts.length, 1); // Implicit events never change counts.
  } finally {
    await context.close();
  }
});

test('preview hosts never initialize or send to the production collector', async () => {
  const { context, page, receipts } = await journey({
    host: 'preview.example.test',
  });
  try {
    await view(page);
    await page.evaluate(() =>
      (window as any).testAnalytics.recordAnalyticsEvent(
        (window as any).testAnalytics.createExampleSearchEvent(3, 0)
      )
    );
    assert.equal(receipts.length, 0);
    assert.deepEqual(await persistentKeys(page), []);
  } finally {
    await context.close();
  }
});

test('unset reloads stay cookieless and session QA tagging survives without persistent identity', async () => {
  const { context, page, receipts } = await journey({
    query: '?analytics_test=true&utm_source=qa&gclid=private-click-id',
  });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    await page.evaluate(() => history.replaceState({}, '', '/'));
    await page.reload();
    await prepare(page);
    await view(page);
    await waitForCount(receipts, 2);
    // Cookieless events carry the SDK's placeholder id; PostHog derives the
    // visitor server-side, so no id is kept in the browser.
    for (const receipt of receipts)
      assert.equal(receipt.properties.distinct_id, '$posthog_cookieless');
    assert.equal(receipts[1].properties.consent_state, 'unset');
    assert.equal(receipts[1].properties.identity_mode, 'ephemeral');
    assert.equal(receipts[1].properties.is_synthetic, true);
    assert.equal(receipts[1].properties.is_internal, false);
    assert.deepEqual(await storedIdentity(page), NOTHING_STORED);
    assert.doesNotMatch(JSON.stringify(receipts), /private-click-id/);
  } finally {
    await context.close();
  }
});

test('a decline on another Expanso site moves this tab to the cookieless lane', async () => {
  const { context, page, receipts } = await journey({ consent: true });
  try {
    await view(page);
    const [accepted] = await waitForEvents(receipts, '$pageview', 1);
    assert.equal(accepted.properties.identity_mode, 'persistent');
    assert.ok(await hasSharedIdentityCookie(page));
    await context.addCookies([
      {
        name: 'expanso-cookie-consent',
        value: 'false',
        domain: '.expanso.io',
        path: '/',
      },
    ]);
    // The visitor comes back to this tab. Chromium may also report the
    // change through cookieStore; the watcher reacts once either way.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await waitForEvents(receipts, '$pageview', 2);
    await view(page, '/next/', '/');
    const views = await waitForEvents(receipts, '$pageview', 3);
    for (const receipt of views.slice(1)) {
      assert.equal(receipt.properties.consent_state, 'denied');
      assert.equal(receipt.properties.identity_mode, 'ephemeral');
      assert.notEqual(
        receipt.properties.distinct_id,
        accepted.properties.distinct_id
      );
    }
    assert.deepEqual(
      views.map((receipt) => receipt.properties.page_path),
      ['/', '/', '/next/']
    );
    const stored = await storedIdentity(page);
    assert.deepEqual(stored.cookies, []);
    assert.deepEqual(await persistentKeys(page), []);
  } finally {
    await context.close();
  }
});

test('a choice made in another tab moves this tab to the cookieless lane', async () => {
  const { context, page, receipts } = await journey({ consent: true });
  try {
    await view(page);
    const [accepted] = await waitForEvents(receipts, '$pageview', 1);
    assert.equal(accepted.properties.identity_mode, 'persistent');
    assert.ok(await hasSharedIdentityCookie(page));
    // A second real tab on another path, so its own lane $pageview is told
    // apart by page_path. Cookieless events carry no $window_id.
    const other = await context.newPage();
    await other.goto('https://examples.expanso.io/other/');
    await prepare(other);
    await other.evaluate(() =>
      (window as any).testAnalytics.setCookieConsent('no')
    );
    // No synthetic event: this tab sees the change through cookieStore or
    // visibility, as a real browser reports it.
    await page.bringToFront();
    const views = await waitForEvents(receipts, '$pageview', 3);
    const here = views.slice(1).filter((v) => v.properties.page_path === '/');
    const there = views.filter((v) => v.properties.page_path === '/other/');
    assert.equal(here.length, 1);
    assert.equal(there.length, 1);
    for (const receipt of [...here, ...there]) {
      assert.equal(receipt.properties.identity_mode, 'ephemeral');
      assert.equal(receipt.properties.consent_state, 'denied');
      assert.notEqual(
        receipt.properties.distinct_id,
        accepted.properties.distinct_id
      );
    }
    assert.equal(
      await page.evaluate(async () =>
        (
          await (window as any).testAnalytics.initializeAnalytics()
        ).has_opted_in_capturing()
      ),
      false
    );
    await page.waitForTimeout(500); // Longer than the SDK's cookie write delay.
    assert.deepEqual((await storedIdentity(page)).cookies, []);
  } finally {
    await context.close();
  }
});

test('a stale SDK opt-in from an earlier accept does not outlive a decline', async () => {
  const { context, page, receipts } = await journey({ consent: false });
  try {
    // Before the next load: the opt-in flag an earlier accept on examples
    // left behind, and a log of every ph_* cookie write.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('stale-flag-seeded')) {
        sessionStorage.setItem('stale-flag-seeded', '1');
        localStorage.setItem(
          '__ph_opt_in_out_phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK',
          '1'
        );
      }
      const writes: string[] = [];
      (window as any).__phWrites = writes;
      (window as any).cookieStore?.addEventListener('change', (event: any) => {
        for (const cookie of [...event.changed, ...event.deleted])
          if (cookie.name.startsWith('ph_')) writes.push(cookie.name);
      });
    });
    await page.reload();
    await prepare(page);
    await view(page);
    const [first] = await waitForEvents(receipts, '$pageview', 1);
    assert.equal(first.properties.identity_mode, 'ephemeral');
    assert.equal(first.properties.consent_state, 'denied');
    assert.equal(first.properties.$cookieless_mode, true);
    assert.equal(first.properties.distinct_id, '$posthog_cookieless');
    await page.waitForTimeout(500); // Longer than the SDK's cookie write delay.
    assert.deepEqual(await page.evaluate(() => (window as any).__phWrites), []);
    assert.deepEqual((await storedIdentity(page)).cookies, []);
  } finally {
    await context.close();
  }
});

test('a host-only consent cookie on examples counts as unset and is deleted', async () => {
  const { context, page, receipts } = await journey({
    consent: true,
    hostOnlyConsent: true,
  });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    assert.equal(receipts[0].properties.consent_state, 'unset');
    assert.equal(receipts[0].properties.identity_mode, 'ephemeral');
    assert.equal(
      await page.evaluate(() => (window as any).expansoExamplesAnalyticsLayer),
      undefined
    );
    assert.deepEqual(await persistentKeys(page), []);
    assert.ok(
      !(await context.cookies()).some(
        (cookie) => cookie.name === 'expanso-cookie-consent'
      )
    );
  } finally {
    await context.close();
  }
});

test('the shared consent cookie wins over a stale host-only copy, which is deleted', async () => {
  const { context, page, receipts } = await journey();
  try {
    // A visitor with an old host-only decline on examples who later accepted
    // on another Expanso site. Seed the host-only copy first: the browser then
    // lists it first in document.cookie, as for a real older cookie.
    await context.addCookies([
      {
        name: 'expanso-cookie-consent',
        value: 'false',
        domain: 'examples.expanso.io',
        path: '/',
      },
    ]);
    await context.addCookies([
      {
        name: 'expanso-cookie-consent',
        value: 'true',
        domain: '.expanso.io',
        path: '/',
      },
    ]);
    await page.reload();
    await prepare(page);
    await view(page);
    await waitForCount(receipts, 1);
    assert.equal(receipts[0].event, '$pageview');
    assert.equal(receipts[0].properties.consent_state, 'granted');
    assert.deepEqual(
      (await context.cookies())
        .filter((cookie) => cookie.name === 'expanso-cookie-consent')
        .map((cookie) => [cookie.domain, cookie.value]),
      [['.expanso.io', 'true']]
    );
  } finally {
    await context.close();
  }
});

test('manual GA uses only its dedicated queue and destination after consent, with no DNT', async () => {
  const { context, page } = await journey();
  try {
    const result = await page.evaluate(() => {
      const w = window as any;
      w.gtag = () => {
        throw new Error('Corporate gtag must never be called');
      };
      const before = JSON.stringify(w.dataLayer ?? []);
      const ga = w.testAnalytics.createGoogleAnalyticsAdapter(
        'G-6YXD85WVC6',
        'examples.expanso.io'
      );
      const props = {
        site_id: 'examples',
        site_host: location.hostname,
        page_path: '/next/?email=private#secret',
        utm_source: 'qa',
        utm_campaign: 'launch',
        utm_term: 'edge-data',
        is_synthetic: true,
        is_internal: false,
      };
      ga.capture('$pageview', props, 'unset');
      ga.capture('$pageview', props, 'denied');
      Object.defineProperty(navigator, 'doNotTrack', {
        configurable: true,
        value: '1',
      });
      ga.capture('$pageview', props, 'granted');
      const blocked = w.expansoExamplesAnalyticsLayer === undefined;
      const blockedScript = !document.querySelector('script[src*="gtag/js"]');
      Object.defineProperty(navigator, 'doNotTrack', {
        configurable: true,
        value: '0',
      });
      ga.capture('$pageview', props, 'granted');
      ga.capture(
        'example_search',
        { ...props, query_length: 3, result_count: 0 },
        'granted'
      );
      ga.capture('pipeline_copy', props, 'denied');
      return {
        blocked,
        blockedScript,
        commands: w.expansoExamplesAnalyticsLayer.map((entry: IArguments) =>
          Array.from(entry)
        ),
        scripts: Array.from(
          document.querySelectorAll<HTMLScriptElement>('script[src*="gtag/js"]')
        ).map((script) => script.src),
        corporateUnchanged: before === JSON.stringify(w.dataLayer ?? []),
        disabledOnRevoke: w['ga-disable-G-6YXD85WVC6'],
      };
    });
    assert.equal(result.blocked, true);
    assert.equal(result.blockedScript, true);
    assert.equal(result.corporateUnchanged, true);
    assert.equal(result.disabledOnRevoke, true);
    assert.equal(result.scripts.length, 1);
    assert.match(
      result.scripts[0],
      /id=G-6YXD85WVC6&l=expansoExamplesAnalyticsLayer$/
    );
    const configs = result.commands.filter(
      (command) => command[0] === 'config'
    );
    assert.equal(configs.length, 1);
    assert.equal(configs[0][1], 'G-6YXD85WVC6');
    assert.equal((configs[0][2] as any).send_page_view, false);
    const events = result.commands.filter((command) => command[0] === 'event');
    assert.deepEqual(
      events.map((command) => command[1]),
      ['page_view', 'example_search']
    );
    for (const command of events) {
      const props = command[2] as any;
      assert.equal(props.send_to, 'G-6YXD85WVC6');
      assert.equal(props.page_location, 'https://examples.expanso.io/next/');
      assert.equal(props.campaign_source, 'qa');
      assert.equal(props.campaign_name, 'launch');
      assert.equal(props.campaign_term, 'edge-data');
      assert.equal(props.debug_mode, true);
      assert.equal(props.traffic_type, 'internal');
    }
    assert.doesNotMatch(JSON.stringify(result.commands), /private|secret/);
  } finally {
    await context.close();
  }
});

test('manual GA rejects absent destination and preview hosts, and leaves regular visits out of internal traffic', async () => {
  const { context, page } = await journey();
  try {
    const result = await page.evaluate(() => {
      const w = window as any;
      for (const [id, host] of [
        ['', location.hostname],
        ['G-6YXD85WVC6', 'preview.example.test'],
      ]) {
        w.testAnalytics
          .createGoogleAnalyticsAdapter(id, host)
          .capture('$pageview', {}, 'granted');
      }
      const blocked = w.expansoExamplesAnalyticsLayer === undefined;
      w.testAnalytics
        .createGoogleAnalyticsAdapter('G-6YXD85WVC6', location.hostname)
        .capture(
          '$pageview',
          { page_path: '/', is_synthetic: false, is_internal: false },
          'granted'
        );
      return {
        blocked,
        event: Array.from(
          w.expansoExamplesAnalyticsLayer.find(
            (entry: IArguments) => entry[0] === 'event'
          )
        ),
      };
    });
    assert.equal(result.blocked, true);
    assert.equal((result.event[2] as any).debug_mode, false);
    assert.equal((result.event[2] as any).traffic_type, undefined);
  } finally {
    await context.close();
  }
});
