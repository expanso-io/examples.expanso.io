import React from 'react';
import clsx from 'clsx';

import { consentEvidenceClient } from '../../lib/analytics';
import {
  type CookieConsentChoice,
  captureConsentChoice,
  setCookieConsent,
} from './cookieConsentUtils';
import styles from './cookies.module.css';

interface CookieConsentControlsProps {
  className?: string;

  // The source of the consent request, e.g. 'banner', 'settings', etc.
  source: string;
}

export function CookieConsentControls({
  className,
  source,
}: CookieConsentControlsProps) {
  const handleChoice = (status: CookieConsentChoice) => {
    // Writing the cookie dispatches COOKIE_CONSENT_CHANGE_EVENT; the watcher in
    // src/lib/analytics.ts hears it and moves PostHog into the right lane and GA to the new
    // consent before the evidence event below is captured.
    setCookieConsent(status);
    captureConsentChoice(consentEvidenceClient, status, source);
  };

  return (
    <div className={clsx(styles.controls, className)}>
      <button
        type="button"
        className="button button--secondary button--sm"
        onClick={() => handleChoice('no')}
      >
        Decline analytics
      </button>
      <button
        type="button"
        className="button button--primary button--sm"
        onClick={() => handleChoice('yes')}
      >
        Accept analytics
      </button>
    </div>
  );
}
