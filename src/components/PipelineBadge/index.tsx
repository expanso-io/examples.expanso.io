import Link from '@docusaurus/Link';

import styles from './styles.module.css';
import type { PipelineCodeKind } from '../../lib/pipelineCode';

export type { PipelineCodeKind } from '../../lib/pipelineCode';

export default function PipelineBadge({
  kind,
  completeHref,
}: {
  kind: PipelineCodeKind;
  completeHref?: string;
}) {
  const label = kind === 'fragment' ? 'Partial snippet' : 'Complete pipeline';

  if (kind === 'fragment' && completeHref) {
    return (
      <Link
        className={styles.badge}
        data-pipeline-kind={kind}
        title="Part of a pipeline, not runnable on its own. Open the complete pipeline."
        to={completeHref}
      >
        {label}
      </Link>
    );
  }

  return (
    <span className={styles.badge} data-pipeline-kind={kind}>
      {label}
    </span>
  );
}
