import React, { useEffect, useState } from 'react';
import {
  MARKETING_CHANGE_EVENT,
  marketingAllowed,
  marketingPrivacySignal,
  setMarketingConsent,
} from '../../lib/visitorMarketing';

export default function MarketingPrivacyChoices(): React.JSX.Element {
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

    sync();
    window.addEventListener(MARKETING_CHANGE_EVENT, sync);
    window.addEventListener('focus', sync);

    return () => {
      window.removeEventListener(MARKETING_CHANGE_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const choose = (allow: boolean) => {
    setError(!setMarketingConsent(allow));
    setAccepted(marketingAllowed());
  };

  return (
    <section aria-label="Marketing consent">
      <p>
        With your permission, Expanso loads a US Browser Speed visitor identity
        matching tag for marketing and advertising on this examples site.
        Accepting analytics does not enable this tag. Marketing is off until you
        choose “Allow marketing” here.
      </p>
      <p>
        The tag contacts the vendor, which receives your IP address and browser
        request headers and may set or read third-party cookies to match visits
        to an identity for advertising. Your browser may block those cookies. We
        send no page URL in the referrer for this request.
      </p>
      <p>
        We remember this choice on this site for up to one year. Global Privacy
        Control and Do Not Track block the tag even if you previously allowed
        marketing. You can return here through “Marketing privacy choices” in
        the footer at any time.
      </p>
      <p>
        Choose “Decline marketing” to withdraw permission. If the tag has
        loaded, the page reloads to stop its code and prevent future requests.
        Other open tabs recheck within one second or when you return to them.
        Withdrawal cannot recall a request already sent, erase data the vendor
        received, or delete its third-party cookies. Use your browser’s cookie
        controls to remove those cookies. See the{' '}
        <a href="https://expanso.io/privacy">Expanso privacy policy</a> for
        privacy rights and contact details.
      </p>
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
