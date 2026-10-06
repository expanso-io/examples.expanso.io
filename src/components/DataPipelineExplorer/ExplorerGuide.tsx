import { useId } from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';

import styles from './guide.module.css';

export interface ExplorerGuideStage {
  slug: string;
  title: string;
  description: string;
}

interface ExplorerGuideProps {
  stages: readonly ExplorerGuideStage[];
}

/**
 * The explanation shown before the Explorer: how to drive it, and an outline
 * of every stage so a reader knows the whole walkthrough before stepping in.
 * Stage links only change the `stage` query parameter, which the Explorer
 * already follows, so this stays free of its navigation handlers.
 */
export default function ExplorerGuide({ stages }: ExplorerGuideProps) {
  const headingId = useId();
  const { pathname, search, hash } = useLocation();

  if (stages.length === 0) return null;

  function stageHref(slug: string): string {
    const params = new URLSearchParams(search);
    params.set('stage', slug);
    return `${pathname}?${params.toString()}${hash}`;
  }

  return (
    <section
      className={styles.guide}
      aria-labelledby={headingId}
      data-explorer-guide=""
    >
      <div className={styles.howTo}>
        <h2 id={headingId} className="margin--none">
          How to use this explorer
        </h2>
        <p style={{ margin: '0.65rem 0 0' }}>
          Move between stages with the arrows or the numbered stage list. Each
          stage shows the input it receives on the left and the output it
          produces on the right, with the lines that changed marked. The
          configuration that makes the change sits below the comparison, and the
          final stage shows the complete pipeline.
        </p>
      </div>
      <div className={styles.outline}>
        <h3 className="margin--none">
          {stages.length === 1
            ? 'The one stage'
            : `The ${stages.length} stages in order`}
        </h3>
        <ol>
          {stages.map((stage) => (
            <li key={stage.slug}>
              <Link to={stageHref(stage.slug)}>{stage.title}</Link>
              <div>{stage.description}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
