import { useEffect, useState, type ReactNode } from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';
import { getCatalogOverviewProjection } from '../../catalog/overviewProjection';
import { EXAMPLE_RECORD_BY_ID } from '../../catalog/registry';
import type { GeneratedExplorerStageFamily } from '../../catalog/explorerStageConfigs.generated';
import DataPipelineExplorer from '../DataPipelineExplorer';
import type { ExampleAction, ExamplePageMeta } from './types';

interface DirectExampleHeaderProps extends ExamplePageMeta {
  eyebrow?: string;
  explorer?: boolean;
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

const explorerFamilyLoaders = {
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
} satisfies Record<string, ExplorerFamilyLoader>;

function InlineExplorer({
  exampleId,
  title,
}: {
  exampleId: string;
  title: string;
}) {
  const [generatedFamily, setGeneratedFamily] =
    useState<GeneratedExplorerStageFamily | null>(null);

  const familyLoader = Object.entries(explorerFamilyLoaders).find(
    ([id]) => id === exampleId
  )?.[1];

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

export function ExampleExplorer({ exampleId }: { exampleId: string }) {
  const { title } = getCatalogOverviewProjection(exampleId).header;

  return <InlineExplorer exampleId={exampleId} title={title} />;
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
  const projection = resolveExampleHeaderProjection(props);
  const { outcome, problem, title } = projection;
  const eyebrow = props.eyebrow ?? 'Expanso example';
  const exampleId = 'exampleId' in props ? props.exampleId : null;
  const record = exampleId ? EXAMPLE_RECORD_BY_ID.get(exampleId) : undefined;

  const setupHref = record
    ? `${record.routes.overview.replace(/\/$/, '')}/setup/`
    : undefined;

  const runHref = record?.routes.run ?? setupHref;
  const deployHref = setupHref ?? record?.routes.reference;

  const executionLabel =
    projection.executionStatus === 'offline-runnable'
      ? 'Runs offline'
      : projection.executionStatus === 'requires-integration'
        ? 'Requires integration'
        : 'Architecture review';

  return (
    <>
      <header
        className={styles.header}
        data-example-surface="overview"
        data-example-template-section="explanation"
      >
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <dl className={styles.meta} aria-label="Example status">
          <div>
            <dt>Level</dt>
            <dd>{projection.difficulty}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{executionLabel}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{projection.expectedTime.inspectMinutes} min to inspect</dd>
          </div>
          <div>
            <dt>Verified</dt>
            <dd>{projection.verifiedAt}</dd>
          </div>
        </dl>
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
        <nav className={styles.actions} aria-label="Example actions">
          <Link
            className="button button--primary"
            to={props.primaryAction.href}
          >
            {props.primaryAction.label}
          </Link>
          {props.secondaryAction ? (
            <Link
              className="button button--secondary"
              to={props.secondaryAction.href}
            >
              {props.secondaryAction.label}
            </Link>
          ) : null}
        </nav>
      </header>
      {exampleId && props.explorer !== false ? (
        <InlineExplorer exampleId={exampleId} title={title} />
      ) : null}
      {record && runHref && deployHref ? (
        <section
          className={styles.runDeploy}
          data-example-template-section="run-deploy"
          aria-labelledby={`${record.id}-run-deploy`}
        >
          <div>
            <p className={styles.sectionLabel}>Next steps</p>
            <h2 id={`${record.id}-run-deploy`}>Run and deploy</h2>
          </div>
          <div className={styles.runDeployGrid}>
            <section>
              <h3>
                {record.executionStatus === 'offline-runnable'
                  ? 'Run the checked example'
                  : 'Review the run path'}
              </h3>
              <p>
                {record.executionStatus === 'offline-runnable'
                  ? 'Use the checked-in fixture and compare the result with the expected output before changing the pipeline.'
                  : 'This example needs its named integrations or platform before it can run. Review the prerequisites and replace example endpoints before testing it.'}
              </p>
              <Link to={runHref}>
                {record.executionStatus === 'offline-runnable'
                  ? 'Open run instructions'
                  : 'Open configuration review'}
              </Link>
            </section>
            <section>
              <h3>Deploy it</h3>
              <p>
                Add the authentication, TLS, storage, network policy, and
                least-privilege settings required by your target before you
                deploy this pipeline.
              </p>
              <Link to={deployHref}>Open deployment requirements</Link>
            </section>
          </div>
        </section>
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
