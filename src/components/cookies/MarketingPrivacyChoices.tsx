import React, { useEffect, useState, type ReactNode } from 'react';
import {
  marketingAllowed,
  marketingPrivacySignal,
  setMarketingConsent,
  watchMarketingConsent,
} from '../../lib/visitorMarketing';

interface MarketingPrivacyChoicesProps {
  children: ReactNode;
}

export default function MarketingPrivacyChoices({
  children,
}: MarketingPrivacyChoicesProps): React.JSX.Element {
  const [accepted, setAccepted] = useState(false);
  const [privacySignal, setPrivacySignal] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAccepted(marketingAllowed());
      setPrivacySignal(marketingPrivacySignal());
      setReady(true);
    };

    return watchMarketingConsent(sync);
  }, []);

  const choose = (allow: boolean) => {
    setError(!setMarketingConsent(allow));
    setAccepted(marketingAllowed());
  };

  return (
    <section aria-label="Marketing consent">
      {children}
      <p role="status">
        {ready
          ? privacySignal
            ? 'Marketing blocked by your browser privacy signal.'
            : accepted
              ? 'Marketing allowed.'
              : 'Marketing off.'
          : 'Loading your choice…'}
      </p>
      <p>
        <button
          type="button"
          className="button button--secondary margin-right--sm margin-bottom--sm"
          disabled={!ready}
          onClick={() => choose(false)}
        >
          Decline marketing
        </button>
        <button
          type="button"
          className="button button--secondary margin-bottom--sm"
          disabled={!ready || privacySignal}
          onClick={() => choose(true)}
        >
          Allow marketing
        </button>
      </p>
      {error && <p role="alert">Your browser could not save this choice.</p>}
    </section>
  );
}
