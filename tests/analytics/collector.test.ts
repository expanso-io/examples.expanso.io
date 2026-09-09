import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { chromium, type Browser, type Page } from '@playwright/test';

let browser: Browser;
let bundle: string;
before(async () => {
  bundle = (
    await build({
      alias: {
        'posthog-js': createRequire(import.meta.url).resolve('posthog-js'),
      },
      stdin: {
        contents: `import * as analytics from './src/lib/analytics';
      import * as events from './src/analytics/events';
      import * as routes from './src/clientModules/posthog';
      import * as google from './src/lib/googleAnalytics';
      window.testAnalytics = {...analytics, ...events, ...routes, ...google};`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
    })
  ).outputFiles[0].text;
  browser = await chromium.launch({
    headless: true,
    channel: process.env.ANALYTICS_BROWSER_CHANNEL,
  });
});
after(async () => {
  await browser?.close();
});

type Receipt = { event: string; properties: Record<string, any> };
test('old linked GA destination is disabled before loaders on scoped hosts', async () => {
  const plugin = createRequire(import.meta.url)(
    '../../plugins/posthog-analytics.cjs'
  )();
  const guard = plugin.injectHtmlTags().headTags[0].innerHTML;
  for (const [host, disabled] of [
    ['examples.expanso.io', true],
    ['docs.expanso.io', true],
    ['expanso.io', false],
    ['www.expanso.io', false],
    ['examples.expanso.io.invalid', false],
  ] as const) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.route('**/*', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<script>${guard}</script><script>window.guardAtLoader = window['ga-disable-G-X1RJ0QGN3Z'] === true;</script>`,
        })
      );
      await page.goto(`https://${host}/`);
      assert.equal(
        await page.evaluate(() => (window as any).guardAtLoader),
        disabled
      );
      assert.equal(
        await page.evaluate(() => (window as any)['ga-disable-G-6YXD85WVC6']),
        undefined
      );
      assert.equal(
        await page.evaluate(() => (window as any)['ga-disable-AW-11179683646']),
        undefined
      );
    } finally {
      await context.close();
    }
  }
});
async function journey(
  options: {
    consent?: boolean;
    host?: string;
    internal?: boolean;
    query?: string;
    referrer?: string;
  } = {}
) {
  const context = await browser.newContext();
  const host = options.host ?? 'examples.expanso.io';
  if (options.consent !== undefined)
    await context.addCookies([
      {
        name: 'expanso-cookie-consent',
        value: String(options.consent),
        domain: host,
        path: '/',
      },
    ]);
  const receipts: Receipt[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === host) {
      await route.fulfill({
        contentType: 'text/html',
        body: `<html><title>Analytics test</title><script>${bundle.replaceAll('</script', '<\\/script')}</script></html>`,
      });
    } else if (url.hostname === 'ph.expanso.io') {
      const body = route.request().postDataBuffer();
      if (body && url.pathname.includes('/e/')) {
        const decoded =
          body[0] === 0x1f && body[1] === 0x8b
            ? gunzipSync(body).toString()
            : body.toString();
        const parsed = JSON.parse(decoded);
        receipts.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      }
      await route.fulfill({ contentType: 'application/json', body: '{}' });
    } else await route.abort(); // No Google, external config or live ingestion.
  });
  const page = await context.newPage();
  if (options.internal)
    await page.addInitScript(() =>
      localStorage.setItem('expanso_analytics_internal', 'true')
    );
  await page.goto(`https://${host}/${options.query ?? ''}`, {
    referer: options.referrer,
  });
  await prepare(page);
  return { context, page, receipts };
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
function persistentKeys(page: Page) {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('ph_'))
  );
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

test('consent uses ephemeral identity until grant, persists on reload and clears identity on revoke', async () => {
  const { context, page, receipts } = await journey({ consent: false });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    const deniedId = receipts[0].properties.distinct_id;
    assert.equal(receipts[0].properties.consent_state, 'denied');
    assert.deepEqual(await persistentKeys(page), []);
    await page.reload();
    await prepare(page);
    await view(page);
    await waitForCount(receipts, 2);
    assert.notEqual(receipts[1].properties.distinct_id, deniedId);
    await page.evaluate(() =>
      (window as any).testAnalytics.setAnalyticsConsent(true)
    );
    await waitForCount(receipts, 3);
    assert.equal(receipts[2].properties.identity_mode, 'persistent');
    const grantedId = receipts[2].properties.distinct_id;
    assert.ok((await persistentKeys(page)).length > 0);
    assert.ok(
      (await context.cookies()).some((cookie) => cookie.name.startsWith('ph_'))
    );
    await page.reload();
    await prepare(page);
    await view(page);
    await waitForCount(receipts, 4);
    assert.equal(receipts[3].properties.distinct_id, grantedId);
    await page.evaluate(() =>
      (window as any).testAnalytics.setAnalyticsConsent(false)
    );
    await waitForCount(receipts, 5);
    assert.equal(receipts[4].properties.identity_mode, 'ephemeral');
    assert.notEqual(receipts[4].properties.distinct_id, grantedId);
    assert.deepEqual(await persistentKeys(page), []);
    assert.ok(
      !(await context.cookies()).some((cookie) => cookie.name.startsWith('ph_'))
    );
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

test('unset reloads stay ephemeral and session QA tagging survives without persistent identity', async () => {
  const { context, page, receipts } = await journey({
    query: '?analytics_test=true&utm_source=qa&gclid=private-click-id',
  });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    const first = receipts[0].properties.distinct_id;
    await page.evaluate(() => history.replaceState({}, '', '/'));
    await page.reload();
    await prepare(page);
    await view(page);
    await waitForCount(receipts, 2);
    assert.notEqual(receipts[1].properties.distinct_id, first);
    assert.equal(receipts[1].properties.consent_state, 'unset');
    assert.equal(receipts[1].properties.is_synthetic, true);
    assert.equal(receipts[1].properties.is_internal, false);
    assert.deepEqual(await persistentKeys(page), []);
    assert.ok(
      !(await context.cookies()).some((cookie) => cookie.name.startsWith('ph_'))
    );
    assert.doesNotMatch(JSON.stringify(receipts), /private-click-id/);
  } finally {
    await context.close();
  }
});

test('shared consent revocation is reconciled before the next event', async () => {
  const { context, page, receipts } = await journey({ consent: true });
  try {
    await view(page);
    await waitForCount(receipts, 1);
    const persistentId = receipts[0].properties.distinct_id;
    await context.addCookies([
      {
        name: 'expanso-cookie-consent',
        value: 'false',
        domain: 'examples.expanso.io',
        path: '/',
      },
    ]);
    await view(page, '/next/', '/');
    await waitForCount(receipts, 2);
    assert.equal(receipts[1].properties.consent_state, 'denied');
    assert.equal(receipts[1].properties.identity_mode, 'ephemeral');
    assert.notEqual(receipts[1].properties.distinct_id, persistentId);
    assert.deepEqual(await persistentKeys(page), []);
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
