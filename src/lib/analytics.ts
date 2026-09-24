import type { BeforeSendFn, PostHogInterface, Properties } from 'posthog-js';
import type { PublicExampleAnalyticsEvent } from '../analytics/events';
import {
  createGoogleAnalyticsAdapter,
  EXAMPLES_GA_MEASUREMENT_ID,
} from './googleAnalytics';

export const ANALYTICS_SITE_HOST = 'examples.expanso.io';
const googleAnalytics = createGoogleAnalyticsAdapter(
  EXAMPLES_GA_MEASUREMENT_ID,
  ANALYTICS_SITE_HOST
);
export const CONSENT_COOKIE_NAME = 'expanso-cookie-consent';
export const PRIVACY_SAFE_CAPTURE_OPTIONS = {
  autocapture: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_pageleave: false,
  capture_pageview: false,
  capture_performance: false,
  disable_session_recording: true,
} as const;

const POSTHOG_API_HOST = 'https://web.t.expanso.io';
const POSTHOG_PROJECT_KEY = 'phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK';

const URL_PROPERTIES = [
  '$current_url',
  '$initial_current_url',
  '$initial_referrer',
  '$referrer',
  '$session_entry_url',
  '$session_entry_referrer',
] as const;

type AnalyticsConsent = 'granted' | 'denied' | 'unset';
type ExampleEventName =
  | 'example_explorer_engaged'
  | 'example_pipeline_copied'
  | 'example_yaml_opened';

export const ANALYTICS_SCHEMA_VERSION = '2026-09-08';
export const TRAFFIC_CLASSIFIER_VERSION = '2026-09-08';
const CAMPAIGN_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;
let entryCampaign: Properties | undefined;

let posthogClientPromise: Promise<PostHogInterface> | undefined;

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export function updateGtmConsent(granted: boolean): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push([
    'consent',
    'update',
    {
      ad_storage: granted ? 'granted' : 'denied',
      analytics_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      personalization_storage: granted ? 'granted' : 'denied',
      functionality_storage: granted ? 'granted' : 'denied',
    },
  ]);
}

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
  if (typeof value !== 'string' || value.length === 0 || value === '$direct')
    return value;

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

  // SDK attribution can include click IDs and URL-derived person properties.
  // Keep only the explicitly supported campaign dimensions, never free text.
  for (const key of Object.keys(properties)) {
    if (
      /^(?:\$initial_)?(?:gclid|gad_source|gclsrc|dclid|fbclid|msclkid|gbraid|wbraid|twclid|li_fat_id|mc_cid|igshid)$/i.test(
        key
      )
    )
      delete properties[key];
    const campaignKey = key.replace(/^\$(?:initial|session_entry)_/, '');
    if (campaignKey.startsWith('utm_')) {
      if (
        CAMPAIGN_FIELDS.includes(
          campaignKey as (typeof CAMPAIGN_FIELDS)[number]
        )
      ) {
        properties[key] = safeCampaignValue(properties[key]);
      } else delete properties[key];
    }
    if (campaignKey === 'ph_keyword') delete properties[key];
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
    : window.location.hostname;
}

function isProductionHost(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.hostname === ANALYTICS_SITE_HOST
  );
}

function safeCampaignValue(value: unknown): string | undefined {
  // Campaign labels only: reject email addresses, URLs, code and arbitrary text.
  return typeof value === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,99}$/.test(value)
    ? value
    : undefined;
}

function campaignProperties(): Properties {
  if (entryCampaign) return entryCampaign;
  entryCampaign = {};
  const query = new URLSearchParams(window.location.search);
  for (const field of CAMPAIGN_FIELDS) {
    const value = safeCampaignValue(query.get(field));
    if (value) entryCampaign[field] = value;
  }
  return entryCampaign;
}

function explicitFlag(storage: Storage, key: string): boolean {
  return storage.getItem(key) === 'true' || storage.getItem(key) === '1';
}

function qaProperties(): Properties {
  let synthetic = ['1', 'true'].includes(
    new URLSearchParams(window.location.search).get('analytics_test') ?? ''
  );
  let internal = false;
  try {
    if (synthetic) window.sessionStorage.setItem('analytics_test', 'true');
    synthetic ||= explicitFlag(window.sessionStorage, 'analytics_test');
  } catch {
    /* Storage may be blocked; the query flag still applies. */
  }
  try {
    internal = explicitFlag(window.localStorage, 'expanso_analytics_internal');
  } catch {
    /* No inferred staff identity. */
  }
  return { is_synthetic: synthetic, is_internal: internal };
}

export function classifyTraffic(
  ua: string,
  width: number,
  height: number,
  screenWidth: number
): string {
  if (
    /bot|crawler|spider|headless|lighthouse|playwright|puppeteer|selenium|curl|wget/i.test(
      ua
    )
  )
    return 'known_automation';
  if (
    /Chrome\/116\./.test(ua) &&
    /Linux/.test(ua) &&
    width === 1080 &&
    height === 600 &&
    screenWidth === 1080
  )
    return 'suspected_automation';
  return 'browser_unclassified';
}

function standardProperties(): Properties {
  const consent = currentConsent();
  return {
    ...campaignProperties(),
    ...qaProperties(),
    $referrer: document.referrer
      ? sanitizeAnalyticsUrl(document.referrer)
      : '$direct',
    $referring_domain: document.referrer
      ? new URL(document.referrer).hostname
      : '$direct',
    site_id: 'examples',
    site_host: currentHost(),
    environment: 'production',
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    consent_state: consent,
    identity_mode: consent === 'granted' ? 'persistent' : 'ephemeral',
    traffic_class: classifyTraffic(
      window.navigator.userAgent,
      window.innerWidth,
      window.innerHeight,
      window.screen.width
    ),
    traffic_classifier_version: TRAFFIC_CLASSIFIER_VERSION,
  };
}

export async function initializeAnalytics(): Promise<
  PostHogInterface | undefined
> {
  if (!isProductionHost()) return undefined;
  if (!posthogClientPromise) {
    posthogClientPromise = import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(POSTHOG_PROJECT_KEY, {
          api_host: POSTHOG_API_HOST,
          defaults: '2026-01-30',
          persistence:
            currentConsent() === 'granted' ? 'localStorage+cookie' : 'memory',
          ...PRIVACY_SAFE_CAPTURE_OPTIONS,
          advanced_disable_feature_flags: true,
          advanced_disable_toolbar_metrics: true,
          disable_capture_url_hashes: true,
          ip: false,
          mask_all_element_attributes: true,
          mask_all_text: true,
          mask_personal_data_properties: true,
          person_profiles: 'never',
          respect_dnt: true,
          opt_out_useragent_filter: true,
          save_campaign_params: false,
          save_referrer: false,
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
  eventName:
    | '$pageview'
    | 'cookie_consent'
    | ExampleEventName
    | PublicExampleAnalyticsEvent['event'],
  properties: Properties = {}
): Promise<void> {
  if (!isProductionHost()) return;
  // Snapshot before loading the SDK so fast navigation cannot move an action
  // onto a later page. The same direct collector owns every semantic event.
  const payload = {
    page_path: currentPath(),
    ...properties,
    ...standardProperties(),
  };
  // Google has its own consent and DNT gate, independent of SDK loading.
  googleAnalytics.capture(eventName, payload, currentConsent());
  const posthog = await initializeAnalytics();
  if (!posthog) return;
  // Consent can change while the lazy SDK import is in flight (or in another
  // tab). Match both identity storage and event labels at the capture boundary.
  const consent = currentConsent();
  const persistence = consent === 'granted' ? 'localStorage+cookie' : 'memory';
  if (posthog.config.persistence !== persistence) {
    posthog.set_config({ persistence });
    if (persistence === 'memory') posthog.reset();
  }
  posthog.capture(eventName, {
    ...payload,
    consent_state: consent,
    identity_mode: consent === 'granted' ? 'persistent' : 'ephemeral',
  });
}

export async function capturePageView(pathname: string): Promise<void> {
  await capture('$pageview', {
    $current_url: `https://${ANALYTICS_SITE_HOST}${pathname}`,
    page_path: pathname,
    page_title: typeof document === 'undefined' ? '' : document.title,
  });
}

export function captureSemanticEvent(event: PublicExampleAnalyticsEvent): void {
  const { event: name, ...properties } = event;
  void capture(name, properties).catch(() => {
    /* Analytics must not interrupt the UI. */
  });
}

export function captureExampleEvent(
  eventName: ExampleEventName,
  properties: Properties = {}
): void {
  void capture(eventName, properties).catch(() => {
    /* Analytics must not interrupt the UI. */
  });
}

function writeConsentCookie(granted: boolean): void {
  const maxAge = 365 * 24 * 60 * 60;
  const domain = window.location.hostname.endsWith('.expanso.io')
    ? '; Domain=.expanso.io'
    : '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  // Remove an older host-only value before writing shared consent so it cannot
  // shadow the new value when document.cookie contains both names.
  if (domain)
    document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0${secure}`;
  document.cookie = `${CONSENT_COOKIE_NAME}=${granted}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domain}${secure}`;
}

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  writeConsentCookie(granted);
  googleAnalytics.setConsent(currentConsent());
  if (!isProductionHost()) return;
  const posthog = await initializeAnalytics();

  if (!posthog) return;
  posthog.set_config({
    persistence: granted ? 'localStorage+cookie' : 'memory',
  });

  if (!granted) posthog.reset();

  await capture('cookie_consent', {
    consent: granted ? 'yes' : 'no',
    method: 'cookie_banner',
    scope: 'analytics',
  });
}
