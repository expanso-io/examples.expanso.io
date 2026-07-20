import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
