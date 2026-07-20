import type { BeforeSendFn, PostHogInterface, Properties } from 'posthog-js';

export const ANALYTICS_SITE_HOST = 'examples.expanso.io';
export const CONSENT_COOKIE_NAME = 'expanso-cookie-consent';

const POSTHOG_API_HOST = 'https://ph.expanso.io';
const POSTHOG_PROJECT_KEY = 'phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK';

const URL_PROPERTIES = [
  '$current_url',
  '$initial_current_url',
  '$initial_referrer',
  '$referrer',
  '$session_entry_url',
] as const;

type AnalyticsConsent = 'granted' | 'denied' | 'unset';
type ExampleEventName =
  | 'example_explorer_engaged'
  | 'example_pipeline_copied'
  | 'example_yaml_opened';

let posthogClientPromise: Promise<PostHogInterface> | undefined;

export function readCookie(
  cookieString: string,
  cookieName: string
): string | undefined {
  return cookieString
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

export function getAnalyticsConsent(
  cookieString: string,
  cookieName = CONSENT_COOKIE_NAME
): AnalyticsConsent {
  const value = readCookie(cookieString, cookieName);
  if (value === 'true') return 'granted';
  if (value === 'false') return 'denied';
  return 'unset';
}

export function sanitizeAnalyticsUrl(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;

  try {
    const parsed = new URL(value, 'https://examples.expanso.io');
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

export const sanitizeAnalyticsEvent: BeforeSendFn = (event) => {
  if (!event?.properties) return event;

  const properties = { ...event.properties };
  for (const propertyName of URL_PROPERTIES) {
    if (propertyName in properties) {
      properties[propertyName] = sanitizeAnalyticsUrl(properties[propertyName]);
    }
  }

  return { ...event, properties };
};

function currentConsent(): AnalyticsConsent {
  if (typeof document === 'undefined') return 'unset';
  return getAnalyticsConsent(document.cookie);
}

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

function currentHost(): string {
  return typeof window === 'undefined'
    ? ANALYTICS_SITE_HOST
    : window.location.host;
}

function isProductionHost(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.hostname === ANALYTICS_SITE_HOST
  );
}

export async function initializeAnalytics(): Promise<PostHogInterface> {
  if (!posthogClientPromise) {
    posthogClientPromise = import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(POSTHOG_PROJECT_KEY, {
          api_host: POSTHOG_API_HOST,
          defaults: '2026-01-30',
          persistence:
            currentConsent() === 'granted' ? 'localStorage+cookie' : 'memory',
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_heatmaps: false,
          disable_session_recording: true,
          advanced_disable_feature_flags: true,
          advanced_disable_toolbar_metrics: true,
          disable_capture_url_hashes: true,
          ip: false,
          mask_all_element_attributes: true,
          mask_all_text: true,
          mask_personal_data_properties: true,
          person_profiles: 'never',
          respect_dnt: true,
          secure_cookie: true,
          before_send: sanitizeAnalyticsEvent,
        });
      }
      return posthog;
    });
  }

  return posthogClientPromise;
}

async function capture(
  eventName: '$pageview' | 'cookie_consent' | ExampleEventName,
  properties: Properties = {}
): Promise<void> {
  if (!isProductionHost()) return;
  const posthog = await initializeAnalytics();
  posthog.capture(eventName, {
    site_host: currentHost(),
    page_path: currentPath(),
    ...properties,
  });
}

export async function capturePageView(pathname: string): Promise<void> {
  await capture('$pageview', {
    $current_url: `https://${ANALYTICS_SITE_HOST}${pathname}`,
    page_path: pathname,
    page_title: typeof document === 'undefined' ? '' : document.title,
  });
}

export function captureExampleEvent(
  eventName: ExampleEventName,
  properties: Properties = {}
): void {
  void capture(eventName, properties);
}

function writeConsentCookie(granted: boolean): void {
  const maxAge = 365 * 24 * 60 * 60;
  const domain = window.location.hostname.endsWith('.expanso.io')
    ? '; Domain=.expanso.io'
    : '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=${granted}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domain}${secure}`;
}

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  writeConsentCookie(granted);
  if (!isProductionHost()) return;
  const posthog = await initializeAnalytics();

  posthog.set_config({
    persistence: granted ? 'localStorage+cookie' : 'memory',
  });

  await capture('cookie_consent', {
    consent: granted ? 'yes' : 'no',
    method: 'cookie_banner',
    scope: 'analytics',
  });
}
