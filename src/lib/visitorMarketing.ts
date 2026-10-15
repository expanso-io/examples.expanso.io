/** Separate, host-only permission: analytics consent never authorizes advertising. */
export const MARKETING_COOKIE = 'expanso-examples-marketing-v1';

export const MARKETING_CHANGE_EVENT = 'examples_marketing_change';

declare global {
  interface Navigator {
    readonly globalPrivacyControl?: boolean;
  }
}

// Use the same build boundary as the site's other third-party integrations.
const VISITOR_TAG_URL =
  process.env.EXPANSO_PRODUCTION_ANALYTICS === '1'
    ? 'https://a.usbrowserspeed.com/cs?pid=ddae2e0bce828a30a7b24f94f87290780f71120eaf9f11353f234c3bd86512d3&puid=%7B%22userId%22%3A%226ad11bf15c45461722106c51%22%2C%22env%22%3A%22prod%22%7D'
    : '';

let tagRequested = false;

export function marketingPrivacySignal(): boolean {
  return (
    navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes'
  );
}

export function marketingAllowed(): boolean {
  if (marketingPrivacySignal()) return false;

  try {
    const values = document.cookie.split(';').flatMap((entry) => {
      const trimmed = entry.trim();

      return trimmed.startsWith(`${MARKETING_COOKIE}=`)
        ? [trimmed.slice(MARKETING_COOKIE.length + 1)]
        : [];
    });

    return values.length === 1 && values[0] === 'yes';
  } catch {
    return false;
  }
}

export function setMarketingConsent(accepted: boolean): boolean {
  // A privacy signal always wins over a stored opt-in or an attempted new opt-in.
  const value = accepted && !marketingPrivacySignal() ? 'yes' : 'no';

  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${MARKETING_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    return false;
  }

  window.dispatchEvent(new Event(MARKETING_CHANGE_EVENT));

  return marketingAllowed() === (value === 'yes');
}

export function watchMarketingConsent(sync: () => void): () => void {
  sync();
  const events = [MARKETING_CHANGE_EVENT, 'focus', 'pageshow'];

  for (const event of events) window.addEventListener(event, sync);
  document.addEventListener('visibilitychange', sync);
  const interval = window.setInterval(sync, 1000);

  return () => {
    for (const event of events) window.removeEventListener(event, sync);
    document.removeEventListener('visibilitychange', sync);
    window.clearInterval(interval);
  };
}

/** One request per document, with rechecks for cross-tab changes and bfcache restores. */
export function watchVisitorMarketing(): () => void {
  if (!VISITOR_TAG_URL) return () => {};

  const sync = () => {
    if (!marketingAllowed()) {
      if (tagRequested) {
        document.getElementById('examples-visitor-marketing')?.remove();
        // Removing a script cannot stop code it already ran. A fresh document tears
        // down vendor timers/listeners and reads the withdrawal before any new load.
        window.location.reload();
      }

      return;
    }

    if (tagRequested) return;
    tagRequested = true;
    const script = document.createElement('script');
    script.id = 'examples-visitor-marketing';
    script.type = 'text/javascript';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = VISITOR_TAG_URL;
    document.head.appendChild(script);
  };

  return watchMarketingConsent(sync);
}
