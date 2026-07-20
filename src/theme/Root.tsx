import React, { useEffect, useState } from 'react';
import {
  CONSENT_COOKIE_NAME,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from '@site/src/lib/analytics';

function updateGtmConsent(granted: boolean): void {
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

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export default function Root({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = getAnalyticsConsent(document.cookie, CONSENT_COOKIE_NAME);
    setShowConsent(consent === 'unset');
    if (consent !== 'unset') {
      updateGtmConsent(consent === 'granted');
    }
  }, []);

  const chooseConsent = (granted: boolean) => {
    setShowConsent(false);
    updateGtmConsent(granted);
    void setAnalyticsConsent(granted);
  };

  return (
    <>
      {children}
      {showConsent && (
        <aside
          className="analytics-consent"
          aria-label="Cookie consent"
          role="dialog"
        >
          <p>
            We use cookies to remember your analytics choice and understand how
            people use these examples.{' '}
            <a href="https://expanso.io/privacy">Learn more</a>
          </p>
          <div className="analytics-consent__actions">
            <button type="button" onClick={() => chooseConsent(false)}>
              Decline
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => chooseConsent(true)}
            >
              Accept
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
