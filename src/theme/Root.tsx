import React, { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from '@docusaurus/router';

import {
  createExampleViewEvent,
  createRelatedExampleClickEvent,
  createRunLocalClickEvent,
  exampleIdFromCatalogPath,
  isRunLocalPath,
  recordAnalyticsEvent,
} from '../analytics/events';
import { PUBLIC_CATALOG } from '../catalog/registry';
import {
  CONSENT_COOKIE_NAME,
  getAnalyticsConsent,
  setAnalyticsConsent,
  updateGtmConsent,
} from '../lib/analytics';

interface RootProps {
  children: ReactNode;
}

function relatedExamplesBlock(anchor: HTMLAnchorElement): boolean {
  let block = anchor.closest('p, ul, ol');
  if (block === null) return false;

  let sibling = block.previousElementSibling;
  while (sibling !== null && !/^H[1-6]$/.test(sibling.tagName)) {
    sibling = sibling.previousElementSibling;
  }

  return sibling?.id === 'related-examples';
}

/** Site-wide delegation covers authored MDX links without copying analytics
 * attributes into every public example. Only normalized route ids are emitted.
 */
export default function Root({ children }: RootProps): React.JSX.Element {
  const location = useLocation();
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = getAnalyticsConsent(document.cookie, CONSENT_COOKIE_NAME);
    setShowConsent(consent === 'unset');
    if (consent !== 'unset') {
      updateGtmConsent(consent === 'granted');
    }
  }, []);

  useEffect(() => {
    const pathname = `/${location.pathname.split('/').filter(Boolean).join('/')}/`;
    const record = PUBLIC_CATALOG.records.find((candidate) =>
      Object.values(candidate.routes).some(
        (route) => route !== undefined && route === pathname
      )
    );
    if (record !== undefined) {
      recordAnalyticsEvent(
        createExampleViewEvent(
          record.id,
          record.executionStatus,
          record.operationalEvidence
        )
      );
    }
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (anchor === null) return;

      const destination = new URL(anchor.href, window.location.origin);
      if (destination.origin !== window.location.origin) return;

      const currentExampleId = exampleIdFromCatalogPath(
        window.location.pathname
      );
      const destinationExampleId = exampleIdFromCatalogPath(
        destination.pathname
      );

      if (
        destinationExampleId !== null &&
        isRunLocalPath(destination.pathname)
      ) {
        recordAnalyticsEvent(createRunLocalClickEvent(destinationExampleId));
      }

      if (
        currentExampleId !== null &&
        destinationExampleId !== null &&
        currentExampleId !== destinationExampleId &&
        relatedExamplesBlock(anchor)
      ) {
        recordAnalyticsEvent(
          createRelatedExampleClickEvent(currentExampleId, destinationExampleId)
        );
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
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
