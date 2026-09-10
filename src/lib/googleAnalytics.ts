// This destination must be the dedicated examples property. Never infer an ID
// from the shared GTM container or another tag already present on the page.
export const EXAMPLES_GA_MEASUREMENT_ID = 'G-6YXD85WVC6';
const DATA_LAYER_NAME = 'expansoExamplesAnalyticsLayer';
type Consent = 'granted' | 'denied' | 'unset';
type EventProperties = Record<string, unknown>;

export function isDoNotTrackEnabled(): boolean {
  const legacyNavigator = navigator as Navigator & { msDoNotTrack?: string };
  const legacyWindow = window as Window & { doNotTrack?: string };
  return [
    navigator.doNotTrack,
    legacyNavigator.msDoNotTrack,
    legacyWindow.doNotTrack,
  ].some((value) => value === '1' || value === 'yes');
}

function sanitizedLocation(path: unknown): string {
  const url = new URL(
    typeof path === 'string' ? path : window.location.pathname,
    window.location.origin
  );
  return `${window.location.origin}${url.pathname}`;
}

/** A separate gtag queue plus an explicit send_to keeps manual events away
 * from corporate tags. No Google script is loaded before consent is granted.
 */
export function createGoogleAnalyticsAdapter(
  measurementId: string,
  productionHost: string
) {
  let initialized = false;
  const validId = /^G-[A-Z0-9]+$/.test(measurementId);
  const browserWindow = () => window as unknown as Record<string, any>;
  const allowed = (consent: Consent) =>
    validId &&
    typeof window !== 'undefined' &&
    window.location.hostname === productionHost &&
    consent === 'granted' &&
    !isDoNotTrackEnabled();

  function command(..._args: unknown[]): void {
    const target = browserWindow();
    target[DATA_LAYER_NAME] ??= [];
    target[DATA_LAYER_NAME].push(arguments);
  }

  function setConsent(consent: Consent): void {
    if (
      !validId ||
      typeof window === 'undefined' ||
      window.location.hostname !== productionHost
    )
      return;
    browserWindow()[`ga-disable-${measurementId}`] = !allowed(consent);
    if (initialized)
      command('consent', 'update', {
        analytics_storage: allowed(consent) ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
  }

  function capture(
    event: string,
    properties: EventProperties,
    consent: Consent
  ): void {
    setConsent(consent);
    if (!allowed(consent)) return;
    const qa =
      properties.is_synthetic === true || properties.is_internal === true;
    const campaign: EventProperties = {};
    for (const [source, destination] of Object.entries({
      utm_source: 'campaign_source',
      utm_medium: 'campaign_medium',
      utm_campaign: 'campaign_name',
      utm_term: 'campaign_term',
      utm_content: 'campaign_content',
    })) {
      const value = properties[source];
      if (
        typeof value === 'string' &&
        /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,99}$/.test(value)
      ) {
        campaign[destination] = value;
      }
    }
    const context = {
      page_location: sanitizedLocation(properties.page_path),
      page_referrer: document.referrer
        ? new URL(document.referrer).origin +
          new URL(document.referrer).pathname
        : '',
      debug_mode: qa,
      ...(qa ? { traffic_type: 'internal' } : {}),
    };
    if (!initialized) {
      initialized = true;
      command('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      command('js', new Date());
      command('config', measurementId, {
        // Keep implicit GA session/engagement metadata sanitized and QA-tagged too.
        ...context,
        ...campaign,
        send_page_view: false,
        groups: 'examples_analytics',
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_domain: productionHost,
        cookie_prefix: 'examples_ga',
      });
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}&l=${DATA_LAYER_NAME}`;
      document.head.appendChild(script);
    }
    const payload: EventProperties = {};
    // Public semantic schema and standard scalar dimensions only. PostHog's
    // automatic properties, raw URLs and identity fields never enter gtag.
    for (const key of [
      'event_schema_version',
      'example_id',
      'execution_status',
      'operational_evidence',
      'stage_id',
      'navigation_method',
      'view',
      'scope',
      'filter_id',
      'result_count',
      'query_length',
      'related_example_id',
      'destination_host',
      'destination_path',
      'site_id',
      'site_host',
      'environment',
      'analytics_schema_version',
      'consent_state',
      'identity_mode',
      'traffic_class',
      'traffic_classifier_version',
      'is_synthetic',
      'is_internal',
    ])
      if (key in properties) payload[key] = properties[key];
    if (Array.isArray(properties.selected_filter_ids))
      payload.selected_filter_ids = properties.selected_filter_ids.join(',');
    command('event', event === '$pageview' ? 'page_view' : event, {
      ...payload,
      ...campaign,
      send_to: measurementId,
      ...context,
    });
  }
  return { capture, setConsent };
}
