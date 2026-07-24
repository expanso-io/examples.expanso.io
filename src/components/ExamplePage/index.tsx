import { useEffect, useState, type ReactNode } from 'react';
import styles from './styles.module.css';
import { getCatalogOverviewProjection } from '../../catalog/overviewProjection';
import type { GeneratedExplorerStageFamily } from '../../catalog/explorerStageConfigs.generated';
import DataPipelineExplorer from '../DataPipelineExplorer';
import type { ExampleAction, ExamplePageMeta } from './types';

interface DirectExampleHeaderProps extends ExamplePageMeta {
  eyebrow?: string;
  outcome: string;
  problem: string;
  primaryAction: ExampleAction;
  secondaryAction?: ExampleAction;
  title: string;
}

interface CatalogExampleHeaderProps extends Partial<DirectExampleHeaderProps> {
  exampleId: string;
  primaryAction: ExampleAction;
}

type ExampleHeaderProps = DirectExampleHeaderProps | CatalogExampleHeaderProps;

interface ExampleHeaderProjection extends ExamplePageMeta {
  outcome: string;
  problem: string;
  title: string;
}

type ExplorerFamilyLoader = () => Promise<GeneratedExplorerStageFamily>;

const explorerFamilyLoaders: Readonly<Record<string, ExplorerFamilyLoader>> = {
  'circuit-breakers': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/circuit-breakers'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'content-routing': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/content-routing'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'content-splitting': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/content-splitting'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'fan-out-pattern': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/fan-out-pattern'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'priority-queues': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/priority-queues'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'smart-buffering': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/smart-buffering'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'encrypt-data': () =>
    import('../../catalog/explorerStageFamilies.generated/encrypt-data').then(
      (module) => module.GENERATED_EXPLORER_STAGE_FAMILY
    ),
  'encryption-patterns': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/encryption-patterns'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'enforce-schema': () =>
    import('../../catalog/explorerStageFamilies.generated/enforce-schema').then(
      (module) => module.GENERATED_EXPLORER_STAGE_FAMILY
    ),
  'remove-pii': () =>
    import('../../catalog/explorerStageFamilies.generated/remove-pii').then(
      (module) => module.GENERATED_EXPLORER_STAGE_FAMILY
    ),
  'aggregate-time-windows': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/aggregate-time-windows'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'deduplicate-events': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/deduplicate-events'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'normalize-timestamps': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/normalize-timestamps'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'parse-logs': () =>
    import('../../catalog/explorerStageFamilies.generated/parse-logs').then(
      (module) => module.GENERATED_EXPLORER_STAGE_FAMILY
    ),
  'transform-formats': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/transform-formats'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'oran-telco-pipeline': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/oran-telco-pipeline'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'scada-energy-edge': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/scada-energy-edge'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'splunk-edge-processing': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/splunk-edge-processing'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'enrich-export': () =>
    import('../../catalog/explorerStageFamilies.generated/enrich-export').then(
      (module) => module.GENERATED_EXPLORER_STAGE_FAMILY
    ),
  'filter-severity': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/filter-severity'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
  'production-pipeline': () =>
    import(
      '../../catalog/explorerStageFamilies.generated/production-pipeline'
    ).then((module) => module.GENERATED_EXPLORER_STAGE_FAMILY),
};

function InlineExplorer({
  exampleId,
  title,
}: {
  exampleId: string;
  title: string;
}) {
  const [generatedFamily, setGeneratedFamily] =
    useState<GeneratedExplorerStageFamily | null>(null);
  const familyLoader = explorerFamilyLoaders[exampleId];

  useEffect(() => {
    if (!familyLoader) return;
    let active = true;
    void familyLoader().then((family) => {
      if (active) setGeneratedFamily(family);
    });
    return () => {
      active = false;
    };
  }, [familyLoader]);

  if (!familyLoader || !generatedFamily) return null;

  return (
    <DataPipelineExplorer
      exampleId={exampleId}
      stages={generatedFamily.stages}
      generatedFamily={generatedFamily}
      fullYaml={generatedFamily.fullYaml}
      fullYamlFilename={generatedFamily.fullYamlFilename}
      title={`${title} pipeline`}
      subtitle=""
    />
  );
}

export function resolveExampleHeaderProjection(
  props: ExampleHeaderProps
): ExampleHeaderProjection {
  if ('exampleId' in props) {
    return getCatalogOverviewProjection(props.exampleId).header;
  }

  return props;
}

export function ExampleHeader(props: ExampleHeaderProps) {
  const { outcome, problem, title } = resolveExampleHeaderProjection(props);
  const eyebrow = props.eyebrow ?? 'Expanso example';
  const exampleId = 'exampleId' in props ? props.exampleId : null;

  return (
    <>
      <header className={styles.header} data-example-surface="overview">
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.intro}>
          <section>
            <h2>The problem</h2>
            <p>{problem}</p>
          </section>
          <section>
            <h2>How Expanso solves it</h2>
            <p>{outcome}</p>
          </section>
        </div>
      </header>
      {exampleId ? (
        <InlineExplorer exampleId={exampleId} title={title} />
      ) : null}
    </>
  );
}

interface ExampleSurfaceProps {
  children: ReactNode;
  description?: string;
  kind: 'overview' | 'explore' | 'run' | 'reference';
  title?: string;
}

export function ExampleSurface({
  children,
  description,
  kind,
  title,
}: ExampleSurfaceProps) {
  if (title?.toLowerCase() === 'system boundary') return null;

  return (
    <section className={styles.surface} data-example-surface={kind}>
      {title ? <h2>{title}</h2> : null}
      {description ? (
        <p className={styles.surfaceDescription}>{description}</p>
      ) : null}
      {children}
    </section>
  );
}

export type { ExampleAction, ExamplePageMeta } from './types';
