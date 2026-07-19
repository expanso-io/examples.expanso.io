import React, { useEffect, type ReactNode } from 'react';
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

  return <>{children}</>;
}
