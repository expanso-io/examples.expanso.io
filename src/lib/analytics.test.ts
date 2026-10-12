import assert from 'node:assert/strict';
import test from 'node:test';
import { consentInitOptions } from '../components/cookies/cookieConsentUtils';
import {
  ANALYTICS_SCHEMA_VERSION,
  classifyTraffic,
  consentState,
  POSTHOG_CAPTURE_OPTIONS,
  posthogInitOptions,
  sanitizeAnalyticsEvent,
  sanitizeAnalyticsUrl,
  TRAFFIC_CLASSIFIER_VERSION,
} from './analytics';

test('captures like docs: autocapture, page leave, heatmaps, web vitals and replay', () => {
  assert.deepEqual(POSTHOG_CAPTURE_OPTIONS, {
    ui_host: 'https://us.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      recordCrossOriginIframes: false,
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
    capture_heatmaps: true,
    capture_performance: true,
  });
  const options = posthogInitOptions('examples.expanso.io');
  for (const [key, value] of Object.entries(POSTHOG_CAPTURE_OPTIONS))
    assert.deepEqual(options[key as keyof typeof options], value, key);
  // Masking all text and attributes would blank autocapture and replay, which
  // docs does not do. Personal data in URL properties stays masked.
  for (const key of [
    'mask_all_text',
    'mask_all_element_attributes',
    'disable_session_recording',
  ])
    assert.equal(key in options, false, key);
  assert.equal(options.mask_personal_data_properties, true);
});

test('maps the shared consent status to the analytics consent state', () => {
  assert.equal(consentState('yes'), 'granted');
  assert.equal(consentState('no'), 'denied');
  assert.equal(consentState('undecided'), 'unset');
});

test('PostHog starts with the consent lanes of the shared contract', () => {
  const options = posthogInitOptions('examples.expanso.io');
  const {
    opt_out_capturing_by_default,
    cookieless_mode,
    persistence,
    cross_subdomain_cookie,
    disable_surveys,
    defaults,
  } = options;
  assert.deepEqual(
    {
      opt_out_capturing_by_default,
      cookieless_mode,
      persistence,
      cross_subdomain_cookie,
      disable_surveys,
      defaults,
    },
    consentInitOptions('examples.expanso.io')
  );
  assert.equal(cross_subdomain_cookie, true);
  assert.equal(defaults, '2026-08-29');
  assert.equal(persistence, 'localStorage+cookie');
  assert.equal(options.api_host, 'https://web.t.expanso.io');
  assert.equal(options.before_send, sanitizeAnalyticsEvent);
  // DNT, person profiles and the IP switch follow the SDK, as on docs.
  for (const key of ['person_profiles', 'respect_dnt', 'ip'])
    assert.equal(key in options, false, key);
  assert.equal(
    posthogInitOptions('preview.example.test').cross_subdomain_cookie,
    false
  );
});

test('identity_mode reports the lane the SDK captured the event in', () => {
  const event = (name: string, properties: Record<string, unknown>) =>
    sanitizeAnalyticsEvent({
      uuid: '00000000-0000-4000-8000-000000000000',
      event: name,
      properties,
    });
  assert.equal(
    event('$pageview', { $cookieless_mode: true })?.properties.identity_mode,
    'ephemeral'
  );
  assert.equal(event('$pageview', {})?.properties.identity_mode, 'persistent');
  for (const name of ['$snapshot', '$$heatmap'])
    assert.equal(
      event(name, { $cookieless_mode: true })?.properties.identity_mode,
      undefined
    );
});

test('removes query strings and fragments from analytics URLs', () => {
  assert.equal(sanitizeAnalyticsUrl('$direct'), '$direct');
  assert.equal(
    sanitizeAnalyticsUrl(
      'https://examples.expanso.io/data-security/remove-pii/?email=a%40b.test#card'
    ),
    'https://examples.expanso.io/data-security/remove-pii/'
  );
});

test('sanitizes every automatic URL property before delivery', () => {
  const event = sanitizeAnalyticsEvent({
    uuid: '00000000-0000-4000-8000-000000000000',
    event: '$pageview',
    properties: {
      $current_url: 'https://examples.expanso.io/?secret=1#token',
      $referrer: 'https://search.example/?q=private',
      safe_property: 'retained',
    },
  });

  assert.equal(event?.properties?.$current_url, 'https://examples.expanso.io/');
  assert.equal(event?.properties?.$referrer, 'https://search.example/');
  assert.equal(event?.properties?.safe_property, 'retained');
});

test('cleans the page URLs nested in heatmap and web vitals events', () => {
  const page = 'https://examples.expanso.io/?email=a%40b.test#card';
  const clean = 'https://examples.expanso.io/';
  const event = (name: string, properties: Record<string, unknown>) =>
    sanitizeAnalyticsEvent({
      uuid: '00000000-0000-4000-8000-000000000000',
      event: name,
      properties,
    });
  // Heatmap batches key their points by page URL; equal keys merge.
  const heatmap = event('$$heatmap', {
    $current_url: page,
    $heatmap_data: {
      [page]: [{ x: 1, y: 2, type: 'click' }],
      'https://examples.expanso.io/?email=c%40d.test': [
        { x: 3, y: 4, type: 'mousemove' },
      ],
    },
  });
  assert.deepEqual(heatmap?.properties.$heatmap_data, {
    [clean]: [
      { x: 1, y: 2, type: 'click' },
      { x: 3, y: 4, type: 'mousemove' },
    ],
  });
  // Web vitals copy the page URL into each metric and its attribution.
  const vitals = event('$web_vitals', {
    $current_url: page,
    $web_vitals_LCP_value: 1200,
    $web_vitals_LCP_event: {
      name: 'LCP',
      value: 1200,
      $current_url: page,
      navigationURL: page,
      attribution: {
        url: 'https://examples.expanso.io/hero.png?email=a%40b.test',
        target: 'img',
      },
    },
    $web_vitals_CLS_event: { name: 'CLS', value: 0, $current_url: page },
  });
  assert.deepEqual(vitals?.properties.$web_vitals_LCP_event, {
    name: 'LCP',
    value: 1200,
    $current_url: clean,
    navigationURL: clean,
    attribution: { url: 'https://examples.expanso.io/hero.png', target: 'img' },
  });
  assert.deepEqual(vitals?.properties.$web_vitals_CLS_event, {
    name: 'CLS',
    value: 0,
    $current_url: clean,
  });
  for (const cleaned of [heatmap, vitals])
    assert.doesNotMatch(JSON.stringify(cleaned), /email/);
});

test('the events the SDK sends by itself get the context of examples events', () => {
  // A visitor on examples who accepted analytics, in a QA session, with the
  // internal flag set.
  const storage = (values: Record<string, string>) => ({
    getItem: (key: string) => values[key] ?? null,
    setItem: () => undefined,
  });
  const globals = {
    window: {
      location: new URL('https://examples.expanso.io/?analytics_test=1'),
      navigator: { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/141.0.0.0' },
      innerWidth: 1280,
      innerHeight: 800,
      screen: { width: 1440 },
      sessionStorage: storage({}),
      localStorage: storage({ expanso_analytics_internal: 'true' }),
    },
    document: {
      get cookie() {
        return 'expanso-cookie-consent=true';
      },
      set cookie(_value: string) {},
    },
  };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  try {
    const event = (name: string, properties: Record<string, unknown>) =>
      sanitizeAnalyticsEvent({
        uuid: '00000000-0000-4000-8000-000000000000',
        event: name,
        properties,
      })?.properties;
    const context = {
      site_id: 'examples',
      site_host: 'examples.expanso.io',
      environment: 'production',
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      consent_state: 'granted',
      traffic_class: 'browser_unclassified',
      traffic_classifier_version: TRAFFIC_CLASSIFIER_VERSION,
      is_synthetic: true,
      is_internal: true,
    };
    assert.deepEqual(event('$autocapture', { $event_type: 'click' }), {
      $event_type: 'click',
      ...context,
      identity_mode: 'persistent',
    });
    assert.deepEqual(event('$pageleave', { $cookieless_mode: true }), {
      $cookieless_mode: true,
      ...context,
      identity_mode: 'ephemeral',
    });
    // An examples event keeps the values its capture call set.
    const own = {
      site_id: 'examples',
      site_host: 'examples.expanso.io',
      environment: 'production',
      analytics_schema_version: '2026-01-01',
      consent_state: 'unset',
      traffic_class: 'known_automation',
      traffic_classifier_version: '2026-01-01',
      is_synthetic: false,
      is_internal: false,
    };
    assert.deepEqual(event('example_pipeline_copied', own), {
      ...own,
      identity_mode: 'persistent',
    });
    // High-volume replay and heatmap batches keep the shape the SDK built.
    assert.deepEqual(event('$snapshot', { $snapshot_data: [] }), {
      $snapshot_data: [],
    });
    assert.deepEqual(event('$$heatmap', { $heatmap_data: {} }), {
      $heatmap_data: {},
    });
  } finally {
    for (const [key, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
  }
});

test('traffic classifier only suspects the exact Chrome116 Linux viewport cohort', () => {
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/116.0.0.0 Safari/537.36';
  assert.equal(classifyTraffic(ua, 1080, 600, 1080), 'suspected_automation');
  assert.equal(classifyTraffic(ua, 1080, 601, 1080), 'browser_unclassified');
  assert.equal(classifyTraffic(ua, 1080, 600, 1920), 'browser_unclassified');
  assert.equal(
    classifyTraffic(ua.replace('116.', '117.'), 1080, 600, 1080),
    'browser_unclassified'
  );
  assert.equal(
    classifyTraffic(ua.replace('Linux', 'Windows'), 1080, 600, 1080),
    'browser_unclassified'
  );
  assert.equal(
    classifyTraffic('Googlebot', 1080, 600, 1080),
    'known_automation'
  );
});

test('delivery strips raw search keywords and invalid campaign labels, including SDK session dimensions', () => {
  const event = sanitizeAnalyticsEvent({
    uuid: '00000000-0000-4000-8000-000000000000',
    event: '$pageview',
    properties: {
      ph_keyword: 'private search',
      $session_entry_ph_keyword: 'private search',
      utm_source: 'newsletter',
      utm_term: 'edge-data',
      $session_entry_utm_content: 'private@example.test',
      utm_unrecognized: 'secret',
      $session_entry_url: 'https://examples.expanso.io/?secret=true#code',
      gclid: 'click-id',
    },
  });
  assert.equal(event?.properties.utm_source, 'newsletter');
  assert.equal(event?.properties.utm_term, 'edge-data');
  assert.doesNotMatch(JSON.stringify(event), /private|secret|code|click-id/);
});
