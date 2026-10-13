import SocialDiscovery from '../components/SocialDiscovery';
import React, { useEffect, type ReactNode } from 'react';
import { useLocation } from '@docusaurus/router';

import {
  createExampleViewEvent,
  firstResultDownloadEvent,
  createRelatedExampleClickEvent,
  createOutboundClickEvent,
  createRunLocalClickEvent,
  exampleAnalyticsClassification,
  exampleIdFromCatalogPath,
  isRunLocalPath,
  recordAnalyticsEvent,
} from '../analytics/events';
import CookieConsentCard from '../components/cookies/CookieConsentCard';

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

  useEffect(() => {
    const pathname = `/${location.pathname.split('/').filter(Boolean).join('/')}/`;
    const classification = exampleAnalyticsClassification(pathname);
    if (classification !== null) {
      recordAnalyticsEvent(
        createExampleViewEvent(
          classification.exampleId,
          classification.executionStatus,
          classification.operationalEvidence
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
      if (destination.origin !== window.location.origin) {
        const outbound = createOutboundClickEvent(
          destination.href,
          exampleIdFromCatalogPath(window.location.pathname) ??
            (window.location.pathname.replace(/\/$/, '') ===
            '/getting-started/process-data-locally'
              ? 'process-data-locally'
              : 'site-navigation')
        );
        if (outbound) recordAnalyticsEvent(outbound);
        return;
      }

      const download = firstResultDownloadEvent(destination.pathname);
      if (download) recordAnalyticsEvent(download);

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

  return (
    <>
      {children}
      <SocialDiscovery />
      <CookieConsentCard />
    </>
  );
}
