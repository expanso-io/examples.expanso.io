import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTraffic,
  getAnalyticsConsent,
  PRIVACY_SAFE_CAPTURE_OPTIONS,
  readCookie,
  sanitizeAnalyticsEvent,
  sanitizeAnalyticsUrl,
} from './analytics';

test('explicitly disables every implicit capture surface', () => {
  assert.deepEqual(PRIVACY_SAFE_CAPTURE_OPTIONS, {
    autocapture: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_pageleave: false,
    capture_pageview: false,
    capture_performance: false,
    disable_session_recording: true,
  });
});

test('reads only the exact consent cookie', () => {
  const cookies = 'unrelated=true; expanso-cookie-consent=false; other=1';
  assert.equal(readCookie(cookies, 'expanso-cookie-consent'), 'false');
  assert.equal(readCookie(cookies, 'missing'), undefined);
});

test('maps shared consent values without guessing', () => {
  assert.equal(getAnalyticsConsent('expanso-cookie-consent=true'), 'granted');
  assert.equal(getAnalyticsConsent('expanso-cookie-consent=false'), 'denied');
  assert.equal(getAnalyticsConsent('expanso-cookie-consent=maybe'), 'unset');
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
