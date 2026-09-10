import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  createGoogleAnalyticsAdapter,
  EXAMPLES_GA_MEASUREMENT_ID,
} from './googleAnalytics';

const host = 'examples.expanso.io';
let scripts: Array<{ src?: string }>;
let browser: Record<string, any>;
let documentStub: Record<string, any>;
const descriptors = new Map<string, PropertyDescriptor | undefined>();

beforeEach(() => {
  scripts = [];
  browser = {
    location: new URL(`https://${host}/?email=private#secret`),
    dataLayer: [['corporate-owned']],
    gtag() {
      throw new Error('Shared gtag is forbidden');
    },
  };
  documentStub = {
    referrer: 'https://search.example/search?q=private',
    cookie: '',
    createElement: () => ({}),
    head: { appendChild: (script: { src?: string }) => scripts.push(script) },
  };
  for (const [key, value] of Object.entries({
    window: browser,
    navigator: { doNotTrack: '0' },
    document: documentStub,
  })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
});
afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  descriptors.clear();
});
const commands = () =>
  (browser.expansoExamplesAnalyticsLayer ?? []).map((entry: IArguments) =>
    Array.from(entry)
  ) as any[][];
const events = () => commands().filter((command) => command[0] === 'event');

test('GA uses the approved dedicated ID, one initialization and explicit destination on every event', () => {
  assert.equal(EXAMPLES_GA_MEASUREMENT_ID, 'G-6YXD85WVC6');
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture('$pageview', { page_path: '/' }, 'granted');
  ga.capture(
    'pipeline_copy',
    { example_id: 'remove-pii', stage_id: 'hash-email', scope: 'full' },
    'granted'
  );
  assert.equal(scripts.length, 1);
  assert.match(
    scripts[0].src!,
    /id=G-6YXD85WVC6&l=expansoExamplesAnalyticsLayer$/
  );
  const configs = commands().filter((command) => command[0] === 'config');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][1], EXAMPLES_GA_MEASUREMENT_ID);
  assert.equal(configs[0][2].send_page_view, false);
  assert.equal(configs[0][2].groups, 'examples_analytics');
  assert.deepEqual(
    events().map((command) => command[1]),
    ['page_view', 'pipeline_copy']
  );
  assert.equal(
    commands().find((command) => command[0] === 'config')![2].traffic_type,
    undefined
  );
  assert.ok(
    events().every(
      (command) => command[2].send_to === EXAMPLES_GA_MEASUREMENT_ID
    )
  );
  assert.deepEqual(browser.dataLayer, [['corporate-owned']]);
});

test('GA sends nothing and loads no script for unset, denied, DNT, invalid ID or non-production host', () => {
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture('$pageview', {}, 'unset');
  ga.capture('$pageview', {}, 'denied');
  Object.defineProperty(navigator, 'doNotTrack', {
    configurable: true,
    value: '1',
  });
  ga.capture('$pageview', {}, 'granted');
  Object.defineProperty(navigator, 'doNotTrack', {
    configurable: true,
    value: '0',
  });
  createGoogleAnalyticsAdapter('', host).capture('$pageview', {}, 'granted');
  createGoogleAnalyticsAdapter(
    EXAMPLES_GA_MEASUREMENT_ID,
    'preview.example.test'
  ).capture('$pageview', {}, 'granted');
  assert.deepEqual(commands(), []);
  assert.equal(scripts.length, 0);
});

test('GA revocation disables the dedicated destination and blocks subsequent events', () => {
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture('$pageview', {}, 'granted');
  ga.setConsent('denied');
  ga.capture('example_search', {}, 'denied');
  assert.equal(browser[`ga-disable-${EXAMPLES_GA_MEASUREMENT_ID}`], true);
  assert.equal(events().length, 1);
  assert.equal(commands().at(-1)[2].analytics_storage, 'denied');
  assert.equal(commands().at(-1)[2].ad_storage, 'denied');
});

test('GA sanitizes locations and referrers, retains campaign labels, and rejects raw private fields', () => {
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture(
    '$pageview',
    {
      page_path: '/next/?email=private#secret',
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch',
      utm_content: 'cta',
      utm_term: 'edge-data',
      raw_search: 'private search',
      code: 'private code',
      distinct_id: 'private-id',
    },
    'granted'
  );
  const props = events()[0][2];
  const config = commands().find((command) => command[0] === 'config')![2];
  assert.equal(config.page_location, `https://${host}/next/`);
  assert.equal(config.page_referrer, 'https://search.example/search');
  assert.equal(config.campaign_source, 'newsletter');
  assert.equal(config.campaign_term, 'edge-data');
  assert.equal(props.page_location, `https://${host}/next/`);
  assert.equal(props.page_referrer, 'https://search.example/search');
  assert.equal(props.campaign_source, 'newsletter');
  assert.equal(props.campaign_medium, 'email');
  assert.equal(props.campaign_name, 'launch');
  assert.equal(props.campaign_content, 'cta');
  assert.equal(props.campaign_term, 'edge-data');
  assert.doesNotMatch(JSON.stringify(commands()), /private|secret/);
});

test('GA marks either synthetic or internal traffic, while leaving ordinary traffic unmarked', () => {
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture('$pageview', { is_synthetic: true }, 'granted');
  ga.capture('$pageview', { is_internal: true }, 'granted');
  ga.capture('$pageview', {}, 'granted');
  assert.equal(
    commands().find((command) => command[0] === 'config')![2].traffic_type,
    'internal'
  );
  assert.ok(
    events()
      .slice(0, 2)
      .every(
        (command) =>
          command[2].debug_mode === true &&
          command[2].traffic_type === 'internal'
      )
  );
  assert.equal(events()[2][2].debug_mode, false);
  assert.equal(events()[2][2].traffic_type, undefined);
});

test('GA preserves allowlisted outbound destination and example context', () => {
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture(
    'outbound_click',
    {
      example_id: 'remove-pii',
      destination_host: 'expanso.io',
      destination_path: '/contact',
      raw_url: 'https://expanso.io/contact?email=private',
    },
    'granted'
  );
  const props = events()[0][2];
  assert.equal(props.example_id, 'remove-pii');
  assert.equal(props.destination_host, 'expanso.io');
  assert.equal(props.destination_path, '/contact');
  assert.equal(props.raw_url, undefined);
});

test('full outbound context stays within a conservative 25-property budget without duplicating campaign labels', () => {
  const ga = createGoogleAnalyticsAdapter(EXAMPLES_GA_MEASUREMENT_ID, host);
  ga.capture(
    'outbound_click',
    {
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      destination_host: 'expanso.io',
      destination_path: '/contact',
      site_id: 'examples',
      site_host: host,
      environment: 'production',
      analytics_schema_version: '1.0.0',
      consent_state: 'granted',
      identity_mode: 'persistent',
      traffic_class: 'browser_unclassified',
      traffic_classifier_version: '1.0.0',
      is_synthetic: true,
      is_internal: true,
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch',
      utm_term: 'pipelines',
      utm_content: 'footer',
    },
    'granted'
  );
  const props = events()[0][2];
  assert.ok(Object.keys(props).length <= 25);
  assert.equal(props.campaign_source, 'newsletter');
  assert.equal(props.campaign_name, 'launch');
  assert.ok(Object.keys(props).every((key) => !key.startsWith('utm_')));
});
