import OriginalCodeBlock from '@theme-original/CodeBlock';
import type { ComponentProps } from 'react';

import PipelineBadge from '../../components/PipelineBadge';
import type { PipelineCodeKind } from '../../lib/pipelineCode';

type Props = ComponentProps<typeof OriginalCodeBlock> & {
  pipelineCodeKind?: PipelineCodeKind;
  completePipelineHref?: string;
};

export default function CodeBlock({
  pipelineCodeKind: kind,
  completePipelineHref,
  ...props
}: Props) {
  if (!kind) return <OriginalCodeBlock {...props} />;

  return (
    <div data-pipeline-code-block={kind}>
      <div className="margin-bottom--sm">
        <PipelineBadge kind={kind} completeHref={completePipelineHref} />
      </div>
      <OriginalCodeBlock {...props} />
    </div>
  );
}
