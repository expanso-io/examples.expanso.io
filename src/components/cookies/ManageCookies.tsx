import React from 'react';

import { COOKIE_CONSENT_OPEN_EVENT } from './CookieConsentCard';
import styles from './cookies.module.css';

/** Footer control: reopens the consent card so a visitor can change an earlier choice. */
export default function ManageCookies() {
  return (
    <button
      type="button"
      className={styles.manage}
      onClick={(event) =>
        window.dispatchEvent(
          new CustomEvent(COOKIE_CONSENT_OPEN_EVENT, {
            detail: { opener: event.currentTarget },
          })
        )
      }
    >
      Cookie settings
    </button>
  );
}
