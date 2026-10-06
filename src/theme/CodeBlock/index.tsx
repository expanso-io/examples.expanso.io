import { useLocation } from '@docusaurus/router';
import OriginalCodeBlock from '@theme-original/CodeBlock';
import type { ComponentProps } from 'react';

import PipelineBadge from '../../components/PipelineBadge';
import {
  classifyPipelineCode,
  type PipelineCodeKind,
} from '../../lib/pipelineCode';
import { completePipelineRouteForPath } from '../../catalog/completePipelineRoutes';
import styles from './styles.module.css';

type Props = ComponentProps<typeof OriginalCodeBlock> & {
  pipelineKind?: PipelineCodeKind;
};

function codeText(children: Props['children']): string {
  return String(children ?? '');
}

export default function CodeBlock({ pipelineKind, ...props }: Props) {
  const location = useLocation();

  const language =
    props.language ??
    /(?:^|\s)language-([^\s]+)/.exec(props.className ?? '')?.[1];

  const kind =
    pipelineKind ??
    (/^ya?ml$/i.test(language ?? '')
      ? classifyPipelineCode(codeText(props.children))
      : null);

  if (!kind) return <OriginalCodeBlock {...props} />;

  return (
    <div className={styles.classifiedCodeBlock} data-pipeline-code-block={kind}>
      <div className={styles.classificationRow}>
        <PipelineBadge
          kind={kind}
          completeHref={completePipelineRouteForPath(location.pathname)}
        />
        {kind === 'fragment' ? (
          <span>Validated in its minimal canonical pipeline context.</span>
        ) : null}
      </div>
      <OriginalCodeBlock {...props} />
    </div>
  );
}
