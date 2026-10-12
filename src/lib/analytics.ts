import type {
  BeforeSendFn,
  PostHogConfig,
  PostHogInterface,
  Properties,
} from 'posthog-js';
import type { PublicExampleAnalyticsEvent } from '../analytics/events';
import {
  applyConsent,
  consentInitOptions,
  getCookieConsent,
  setCookieConsent,
  syncSdkConsentFlag,
  watchConsent,
  type CookieConsentStatus,
} from '../components/cookies/cookieConsentUtils';
import {
  createGoogleAnalyticsAdapter,
  EXAMPLES_GA_MEASUREMENT_ID,
} from './googleAnalytics';

export const ANALYTICS_SITE_HOST = 'examples.expanso.io';
// Only the main-branch production build sets this switch (production-build
// job in .github/workflows/phase1-foundation.yml). The bundler inlines it, so
// every other build compiles out the PostHog and Google delivery code along
// with their hosts, project key and measurement ID.
const PRODUCTION_ANALYTICS = process.env.EXPANSO_PRODUCTION_ANALYTICS === '1';
const googleAnalytics = PRODUCTION_ANALYTICS
  ? createGoogleAnalyticsAdapter(
      EXAMPLES_GA_MEASUREMENT_ID,
      ANALYTICS_SITE_HOST
    )
  : undefined;
// docs.expanso.io's capture settings (src/analytics/client.mjs). The manual
// $pageview stays: clientModules/posthog.ts sends one per route.
export const POSTHOG_CAPTURE_OPTIONS = {
  // The toolbar and heatmaps open from the PostHog app, not from the proxy.
  ui_host: 'https://us.posthog.com',
  capture_pageview: false,
  capture_pageleave: true,
  autocapture: true,
  // This starts the recorder only when the PostHog project enables replay.
  session_recording: {
    recordCrossOriginIframes: false,
    maskAllInputs: false,
    maskInputOptions: { password: true },
  },
  capture_heatmaps: true,
  // Web vitals.
  capture_performance: true,
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

let posthogClientPromise: Promise<PostHogInterface | undefined> | undefined;

/** Maps the shared contract's status to the consent_state label and GA. */
export function consentState(status: CookieConsentStatus): AnalyticsConsent {
  if (status === 'yes') return 'granted';
  if (status === 'no') return 'denied';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  // Heatmap batches key their points by page URL; merge keys that clean to
  // the same URL.
  if (event.event === '$$heatmap' && isRecord(properties.$heatmap_data)) {
    const heatmapData: Record<string, unknown[]> = {};
    for (const [url, points] of Object.entries(properties.$heatmap_data))
      (heatmapData[String(sanitizeAnalyticsUrl(url))] ??= []).push(
        ...(Array.isArray(points) ? points : [])
      );
    properties.$heatmap_data = heatmapData;
  }
  // Web vitals copy the page URL into each metric and its attribution.
  for (const key of Object.keys(properties)) {
    const metric = properties[key];
    if (!/^\$web_vitals_\w+_event$/.test(key) || !isRecord(metric)) continue;
    const cleaned: Record<string, unknown> = { ...metric };
    for (const field of ['$current_url', 'navigationURL'])
      if (field in cleaned)
        cleaned[field] = sanitizeAnalyticsUrl(cleaned[field]);
    if (isRecord(metric.attribution) && 'url' in metric.attribution)
      cleaned.attribution = {
        ...metric.attribution,
        url: sanitizeAnalyticsUrl(metric.attribution.url),
      };
    properties[key] = cleaned;
  }
  // High-volume replay and heatmap batches keep the shape the SDK built.
  if (event.event !== '$snapshot' && event.event !== '$$heatmap') {
    // The events the SDK sends by itself ($autocapture, $pageleave,
    // $web_vitals and the others) get the context of examples' own events, as
    // on docs. A field that examples' capture call set keeps its value.
    if (typeof window !== 'undefined')
      for (const [key, value] of Object.entries(contextProperties()))
        if (!(key in properties)) properties[key] = value;
    // The SDK marks every cookieless event with $cookieless_mode before
    // before_send, so identity_mode reports the lane the event was captured
    // in, as on docs.
    properties.identity_mode = properties.$cookieless_mode
      ? 'ephemeral'
      : 'persistent';
  }
  return { ...event, properties };
};

/**
 * posthog.init options: the consent lanes from the shared contract (opt-out by
 * default, cookieless on reject, the .expanso.io identity cookie, the pinned
 * defaults date), then docs' capture settings and examples' URL and campaign
 * privacy settings. Nothing after the spread may override a consent key.
 */
export function posthogInitOptions(hostname: string): Partial<PostHogConfig> {
  return {
    ...consentInitOptions(hostname),
    api_host: POSTHOG_API_HOST,
    ...POSTHOG_CAPTURE_OPTIONS,
    advanced_disable_feature_flags: true,
    advanced_disable_toolbar_metrics: true,
    disable_capture_url_hashes: true,
    mask_personal_data_properties: true,
    opt_out_useragent_filter: true,
    save_campaign_params: false,
    save_referrer: false,
    secure_cookie: true,
    before_send: sanitizeAnalyticsEvent,
  };
}

// The contract reads only the shared .expanso.io cookie on production hosts
// and deletes a host-only copy, as on docs and the main sites.
function currentConsent(): AnalyticsConsent {
  return consentState(getCookieConsent());
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
    PRODUCTION_ANALYTICS &&
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

// The context of every examples event that does not depend on the capture
// call. before_send also adds it to the events the SDK sends by itself.
function contextProperties(): Properties {
  return {
    ...qaProperties(),
    site_id: 'examples',
    site_host: currentHost(),
    environment: 'production',
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    consent_state: currentConsent(),
    traffic_class: classifyTraffic(
      window.navigator.userAgent,
      window.innerWidth,
      window.innerHeight,
      window.screen.width
    ),
    traffic_classifier_version: TRAFFIC_CLASSIFIER_VERSION,
  };
}

function standardProperties(): Properties {
  return {
    ...campaignProperties(),
    $referrer: document.referrer
      ? sanitizeAnalyticsUrl(document.referrer)
      : '$direct',
    $referring_domain: document.referrer
      ? new URL(document.referrer).hostname
      : '$direct',
    ...contextProperties(),
  };
}

// Whether the SDK runs in the persistent lane (opted in), not the cookieless
// one. It must never throw, because the consent change still has to apply.
function persistentLane(posthog: PostHogInterface): boolean {
  try {
    return posthog.has_opted_in_capturing();
  } catch {
    return false;
  }
}

// The switch is spelled out here because webpack only skips the dynamic
// import, and with it the SDK chunk, when the dead branch is visible to it.
const loadPostHog =
  process.env.EXPANSO_PRODUCTION_ANALYTICS === '1'
    ? () =>
        import('posthog-js').then(({ default: posthog }) => {
          if (!posthog.__loaded) {
            const status = getCookieConsent();
            // Before init: mirror the shared cookie into the SDK's per-origin
            // flag, or a visitor who accepted on another Expanso site starts
            // cookieless here and loses the shared identity.
            syncSdkConsentFlag(POSTHOG_PROJECT_KEY, status);
            try {
              posthog.init(
                POSTHOG_PROJECT_KEY,
                posthogInitOptions(window.location.hostname)
              );
            } catch {
              // posthog-js can throw in locked-down storage contexts.
              return undefined;
            }
            applyConsent(posthog, status);
            // Same tab, other tabs (focus, visibility) and other Expanso
            // sites (the same shared cookie).
            watchConsent((next) => {
              // A lane change makes posthog-js start a new identity and
              // session; give the new session a page view of its own.
              const was = persistentLane(posthog);
              applyConsent(posthog, next);
              if (persistentLane(posthog) !== was)
                void capturePageView(window.location.pathname).catch(() => {
                  /* Analytics must not interrupt the UI. */
                });
            });
          }
          return posthog;
        })
    : () => Promise.resolve(undefined);

export async function initializeAnalytics(): Promise<
  PostHogInterface | undefined
> {
  if (!isProductionHost()) return undefined;
  if (!posthogClientPromise) posthogClientPromise = loadPostHog();
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
  // Google has its own consent and DNT gate, independent of SDK loading. It
  // sends only after a yes, with its own cookies.
  googleAnalytics?.capture(
    eventName,
    { ...payload, identity_mode: 'persistent' },
    currentConsent()
  );
  const posthog = await initializeAnalytics();
  if (!posthog) return;
  // Consent can change while the lazy SDK import is in flight. The label is
  // read again here; the lane is the SDK's, and before_send reports it.
  posthog.capture(eventName, { ...payload, consent_state: currentConsent() });
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

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  // The cookie write dispatches cookie_consent_change; the watcher started in
  // loadPostHog moves the SDK to the matching lane synchronously.
  setCookieConsent(granted ? 'yes' : 'no');
  googleAnalytics?.setConsent(currentConsent());
  if (!isProductionHost()) return;
  await capture('cookie_consent', {
    consent: granted ? 'yes' : 'no',
    method: 'cookie_banner',
    scope: 'analytics',
  });
}
