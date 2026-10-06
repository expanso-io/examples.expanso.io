/** Every third-party analytics host and identifier this site can emit.
 *
 * One list feeds the build verifier and the browser tests, so a tag cannot be
 * added without being both gated behind EXPANSO_PRODUCTION_ANALYTICS and
 * blocked at the network layer wherever a production-variant build is opened.
 */

/** Hosts the site contacts, or that the retired GTM container contacted.
 * Matched as a full hostname or any subdomain of it. */
export const ANALYTICS_HOSTS = [
  // Scarf pixel
  'static.scarf.sh',
  // gtag.js for the dedicated GA adapter, and the retired GTM and Google Ads
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'googleadservices.com',
  'googlesyndication.com',
  'doubleclick.net',
  // PostHog, through the managed proxy and direct
  'web.t.expanso.io',
  'posthog.com',
  // Tags the retired GTM container fired
  'clarity.ms',
  'licdn.com',
  'ads.linkedin.com',
  'hs-scripts.com',
  'hs-analytics.net',
  'hs-banner.com',
  'hscollectedforms.net',
  'hsforms.net',
  'hsforms.com',
  'hubspot.com',
  'usemessages.com',
  'lfeeder.com',
  'analytics.ahrefs.com',
  'survicate.com',
  'leadsy.ai',
] as const;

/** Identifiers that reveal a tag even when its host is not spelled out. */
export const ANALYTICS_MARKERS = [
  'GTM-MPSKFDMF',
  'G-6YXD85WVC6',
  'G-X1RJ0QGN3Z',
  'phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK',
  'x-pxid=82d5c930-f525-4047-bb21-25a09e68ed2d',
] as const;

/** What every real page of the production build must carry. Each pattern
 * pins a tag's identity (host, path and identifier) and tolerates whatever
 * whitespace, quoting or inlining the HTML minifier and the tag plugins
 * produce. */
export const PRODUCTION_PAGE_TAGS = [
  {
    id: 'scarf-pixel',
    pattern:
      /<img\b[^>]*\bsrc\s*=\s*["']https:\/\/static\.scarf\.sh\/a\.png\?x-pxid=82d5c930-f525-4047-bb21-25a09e68ed2d["'][^>]*>/,
  },
] as const;

/** The only hosts and identifiers a production build may carry. Any other
 * entry of ANALYTICS_HOSTS or ANALYTICS_MARKERS, and any other Google tag id,
 * would send data outside these consent rules. That is how the retired
 * Google Tag Manager container fired GA4, Google Ads and six other vendors
 * before any consent choice; expanso.io and docs.expanso.io removed it too.
 * googletagmanager.com is allowed only as the gtag.js path the dedicated GA
 * adapter loads after consent. */
export const PRODUCTION_ALLOWED_TAGS = [
  'static.scarf.sh',
  'web.t.expanso.io',
  'posthog.com',
  'G-6YXD85WVC6',
  'phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK',
  'x-pxid=82d5c930-f525-4047-bb21-25a09e68ed2d',
] as const;

const GTAG_PATH = 'googletagmanager.com/gtag/js';

/** Google Tag Manager containers, Google Ads accounts and GA4 streams. */
const GOOGLE_TAG_IDS = /\b(?:GTM-[A-Z0-9]{4,}|AW-\d{6,}|G-[A-Z0-9]{6,})\b/g;

function isAllowed(needle: string): boolean {
  return (PRODUCTION_ALLOWED_TAGS as readonly string[]).includes(needle);
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** Every analytics host or identifier in `text` outside PRODUCTION_ALLOWED_TAGS. */
export function unapprovedTags(text: string): string[] {
  const found: string[] = [];
  for (const needle of [...ANALYTICS_HOSTS, ...ANALYTICS_MARKERS]) {
    if (!text.includes(needle) || isAllowed(needle)) continue;
    if (
      needle === 'googletagmanager.com' &&
      occurrences(text, needle) === occurrences(text, GTAG_PATH)
    ) {
      continue;
    }
    found.push(needle);
  }
  for (const [id] of text.matchAll(GOOGLE_TAG_IDS)) {
    if (!isAllowed(id) && !found.includes(id)) found.push(id);
  }
  return found;
}

/** What the production JavaScript must carry: the direct PostHog collector and
 * the dedicated Google Analytics adapter. */
export const PRODUCTION_SCRIPT_MARKERS = [
  'web.t.expanso.io',
  'phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK',
  'googletagmanager.com/gtag/js',
  'G-6YXD85WVC6',
] as const;

export function isAnalyticsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ANALYTICS_HOSTS.some(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`)
  );
}

/** Chrome DevTools URL block patterns, for Lighthouse. */
export function analyticsBlockedUrlPatterns(): string[] {
  return ANALYTICS_HOSTS.map((host) => `*${host}/*`);
}
