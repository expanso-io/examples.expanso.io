import React, { useEffect, useRef, type ReactNode } from 'react';
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

interface PendingPipelineStepScroll {
  pathname: string;
  top: number;
}

function pipelineStepPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const stepIndex = segments.findIndex((segment) => /^step-\d+/.test(segment));

  return stepIndex > 0 ? `/${segments.slice(0, stepIndex).join('/')}/` : null;
}

function preservesPipelineStepScroll(
  currentPathname: string,
  destinationPathname: string
): boolean {
  const currentPipeline = pipelineStepPath(currentPathname);

  return (
    currentPipeline !== null &&
    currentPipeline === pipelineStepPath(destinationPathname) &&
    currentPathname !== destinationPathname
  );
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
  const pendingPipelineStepScroll = useRef<PendingPipelineStepScroll | null>(
    null
  );

  useEffect(() => {
    const pendingScroll = pendingPipelineStepScroll.current;
    if (pendingScroll?.pathname !== location.pathname) return;

    pendingPipelineStepScroll.current = null;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: pendingScroll.top, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

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
      if (
        event.button !== 0 ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (anchor === null) return;

      if (anchor.target || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.origin);
      if (destination.origin !== window.location.origin) return;

      if (
        preservesPipelineStepScroll(
          window.location.pathname,
          destination.pathname
        )
      ) {
        pendingPipelineStepScroll.current = {
          pathname: destination.pathname,
          top: window.scrollY,
        };
      }

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
