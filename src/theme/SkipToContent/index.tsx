import React, { useCallback, useRef } from 'react';
import { useHistory } from '@docusaurus/router';
import { translate } from '@docusaurus/Translate';
import { SkipToContentFallbackId } from '@docusaurus/theme-common';
import { useLocationChange } from '@docusaurus/theme-common/internal';

import { shouldResetFocusAfterNavigation } from './focusReset';
import styles from './styles.module.css';

function skipToContentTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('main:first-of-type') ??
    document.getElementById(SkipToContentFallbackId)
  );
}

function programmaticFocus(element: HTMLElement): void {
  element.setAttribute('tabindex', '-1');
  element.focus();
  element.removeAttribute('tabindex');
}

const label = translate({
  id: 'theme.common.skipToMainContent',
  description:
    'The skip to content label used for accessibility, allowing to rapidly navigate to main content with keyboard tab/enter navigation',
  message: 'Skip to main content',
});

/**
 * Replaces the theme's SkipToContent so a same-page query-string navigation
 * keeps focus and scroll position. Real page changes still reset focus.
 */
export default function SkipToContent(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { action } = useHistory();

  const onClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = skipToContentTarget();
    if (target) programmaticFocus(target);
  }, []);

  useLocationChange(({ location, previousLocation }) => {
    if (
      containerRef.current &&
      shouldResetFocusAfterNavigation({ action, location, previousLocation })
    ) {
      programmaticFocus(containerRef.current);
    }
  });

  return (
    <div ref={containerRef} role="region" aria-label={label}>
      {/* Fallback href keeps the link useful without JavaScript. */}
      <a
        className={styles.skipToContent}
        href={`#${SkipToContentFallbackId}`}
        onClick={onClick}
      >
        {label}
      </a>
    </div>
  );
}
