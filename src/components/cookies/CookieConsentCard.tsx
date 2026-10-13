import React, { useEffect, useRef, useState } from 'react';

import { consentEvidenceClient } from '../../lib/analytics';
import { CookieConsentControls } from './CookieConsentControls';
import {
  type CookieConsentStatus,
  COOKIE_CONSENT_CHANGE_EVENT,
  dismissConsentBanner,
  getCookieConsent,
  isConsentBannerDismissed,
  readGeo,
  watchConsent,
} from './cookieConsentUtils';
import styles from './cookies.module.css';

// The address tests/analytics/events.test.ts allows; expanso.io redirects it to the policy.
export const PRIVACY_POLICY = 'https://expanso.io/privacy';
/** Dispatched by ManageCookies to reopen the card for a visitor who already chose. */
export const COOKIE_CONSENT_OPEN_EVENT = 'cookie_consent_open';

const CHOICE_LABEL: Record<CookieConsentStatus, string> = {
  yes: 'Accepted',
  no: 'Declined',
  undecided: 'Undecided',
};

/**
 * The card unmounts when it closes, which drops a focused button's focus to <body>. When the
 * visitor opened it from "Cookie settings", hand focus back to that control instead, and
 * forget it either way: the first-visit card has no opener, so focus falls to <body> there,
 * as on expanso.io, instead of jumping to a footer button from an earlier visit.
 *
 * Safari, and Firefox on macOS, do not focus a clicked button, so a click inside the card
 * leaves focus on <body>. `byVisitor` counts that as the card's too; a close caused
 * elsewhere (another tab or site) never moves focus the visitor did not leave in the card.
 */
function returnFocus(
  card: HTMLElement | null,
  openerRef: React.MutableRefObject<HTMLElement | null>,
  byVisitor: boolean
) {
  const opener = openerRef.current;
  openerRef.current = null;
  if (!card || !opener) return;
  const active = document.activeElement;
  const onBody = active === null || active === document.body;
  if (card.contains(active) || (byVisitor && onBody)) opener.focus();
}

export default function CookieConsentCard(): React.JSX.Element | null {
  const cardRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Start hidden: the cookie is only readable in the browser, and SSR must not flash the card.
  const [consentStatus, setConsentStatus] = useState<CookieConsentStatus>('no');
  const [dismissed, setDismissed] = useState(true);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const syncToConsent = (byVisitor: boolean) => {
      const status = getCookieConsent();
      const closed = isConsentBannerDismissed();
      // The reopened card hides unless it falls back to the first-visit card, which keeps
      // focus where the visitor has it; the opener is forgotten either way.
      if (status !== 'undecided' || closed)
        returnFocus(cardRef.current, openerRef, byVisitor);
      else openerRef.current = null;
      setConsentStatus(status);
      setDismissed(closed);
      setReopened(false);
    };
    const handleChoice = () => syncToConsent(true);
    const handleOpen = (event: Event) => {
      // ManageCookies names itself, because Safari does not focus the button on click.
      const named =
        event instanceof CustomEvent ? event.detail?.opener : undefined;
      const active = document.activeElement;
      openerRef.current =
        named instanceof HTMLElement
          ? named
          : active instanceof HTMLElement && active !== document.body
            ? active
            : null;
      setConsentStatus(getCookieConsent());
      setReopened(true);
    };
    syncToConsent(false);

    // Same-tab choices, including re-confirming the current one from the reopened card (the
    // value does not change, so only this listener closes the card in that case).
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleChoice);
    // Choices made in another tab or on another Expanso site: re-read on focus/visibility
    // and cookieStore changes, and only when the recorded value actually changed.
    const stopWatching = watchConsent(() => syncToConsent(false));
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen);

    return () => {
      stopWatching();
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleChoice);
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen);
    };
  }, []);

  useEffect(() => {
    // Only the reopened settings card closes on Escape: a visitor who opens "Cookie settings"
    // just to look can leave without re-asserting a choice. The first-visit banner never takes
    // focus, so an Escape meant for something else on the page must not dismiss it; it closes
    // through its own button.
    if (!reopened) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      returnFocus(cardRef.current, openerRef, true);
      setReopened(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reopened]);

  if ((consentStatus !== 'undecided' || dismissed) && !reopened) return null;

  // Records no choice: never writes the consent cookie or a cookie_consent event, unlike the
  // Accept/Decline buttons below. For an undecided visitor the contract keeps this site's
  // first-visit card closed for 30 days; it re-reads the cookies, so a close already made in
  // another tab, or on a card reopened after a choice, is not counted.
  const handleClose = () => {
    dismissConsentBanner(
      consentEvidenceClient,
      reopened ? 'settings' : 'banner'
    );
    returnFocus(cardRef.current, openerRef, true);
    setDismissed(true);
    setReopened(false);
  };

  return (
    <section
      ref={cardRef}
      className={styles.card}
      aria-label="Analytics privacy choices"
    >
      <p className={styles.text}>
        {/* A row visitor who declined runs cookieless, so "running now" would be false. */}
        {readGeo() === 'row' && consentStatus !== 'no'
          ? 'We use analytics to understand how people use these examples. It is running now; ' +
            'decline below to turn it off.'
          : 'We use analytics to understand how people use these examples. Until you accept, we ' +
            'measure anonymously and keep no analytics cookies or data on your device. ' +
            'Accepting lets us recognise repeat visits.'}{' '}
        <a href={PRIVACY_POLICY} target="_blank" rel="noreferrer">
          Read our privacy policy
        </a>
        .
      </p>
      {reopened && (
        <p className={styles.choice}>
          Your current choice: {CHOICE_LABEL[consentStatus]}
        </p>
      )}
      <CookieConsentControls source={reopened ? 'settings' : 'banner'} />
      {/* Last in DOM order, so Tab reaches the notice and both choices before the exit that
          makes none; positioned in the top-right corner. */}
      <button
        type="button"
        className={styles.close}
        aria-label="Close"
        onClick={handleClose}
      >
        &times;
      </button>
    </section>
  );
}
