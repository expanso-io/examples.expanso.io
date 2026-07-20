import { useEffect, useId, useState, type ReactNode } from 'react';
import styles from './styles.module.css';
import { getCatalogOverviewProjection } from '../../catalog/overviewProjection';
import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../catalog/explorerStageConfigs.generated';
import DataPipelineExplorer from '../DataPipelineExplorer';
import type { Stage } from '../DataPipelineExplorer/types';
import type {
  BoundaryFlow,
  BoundaryNode,
  ExampleAction,
  ExamplePageMeta,
} from './types';

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

type ExplorerStageLoader = () => Promise<readonly Stage[]>;

const explorerStageLoaders: Readonly<Record<string, ExplorerStageLoader>> = {
  'circuit-breakers': () =>
    import('@site/docs/data-routing/circuit-breakers-full.stages').then(
      (module) => module.circuitBreakerStages
    ),
  'content-routing': () =>
    import('@site/docs/data-routing/content-routing-full.stages').then(
      (module) => module.contentRoutingStages
    ),
  'content-splitting': () =>
    import('@site/docs/data-routing/content-splitting-full.stages').then(
      (module) => module.contentSplittingStages
    ),
  'fan-out-pattern': () =>
    import('@site/docs/data-routing/fan-out-pattern-full.stages').then(
      (module) => module.fanOutPatternStages
    ),
  'priority-queues': () =>
    import('@site/docs/data-routing/priority-queues-full.stages').then(
      (module) => module.priorityQueuesStages
    ),
  'smart-buffering': () =>
    import('@site/docs/data-routing/smart-buffering-full.stages').then(
      (module) => module.smartBufferingStages
    ),
  'encrypt-data': () =>
    import('@site/docs/data-security/encrypt-data-full.stages').then(
      (module) => module.encryptDataStages
    ),
  'encryption-patterns': () =>
    import('@site/docs/data-security/encryption-patterns-full.stages').then(
      (module) => module.encryptionPatternsStages
    ),
  'enforce-schema': () =>
    import('@site/docs/data-security/enforce-schema-full.stages').then(
      (module) => module.enforceSchemaStages
    ),
  'remove-pii': () =>
    import('@site/docs/data-security/remove-pii-full.stages').then(
      (module) => module.removePiiFullStages
    ),
  'aggregate-time-windows': () =>
    import(
      '@site/docs/data-transformation/aggregate-time-windows-full.stages'
    ).then((module) => module.aggregateTimeWindowsStages),
  'deduplicate-events': () =>
    import(
      '@site/docs/data-transformation/deduplicate-events-full.stages'
    ).then((module) => module.deduplicateEventsStages),
  'normalize-timestamps': () =>
    import(
      '@site/docs/data-transformation/normalize-timestamps-full.stages'
    ).then((module) => module.normalizeTimestampsStages),
  'parse-logs': () =>
    import('@site/docs/data-transformation/parse-logs-full.stages').then(
      (module) => module.parseLogsStages
    ),
  'transform-formats': () =>
    import('@site/docs/data-transformation/transform-formats-full.stages').then(
      (module) => module.transformFormatsStages
    ),
  'oran-telco-pipeline': () =>
    import('@site/docs/integrations/oran-telco-pipeline-full.stages').then(
      (module) => module.oranTelcoPipelineStages
    ),
  'scada-energy-edge': () =>
    import('@site/docs/integrations/scada-energy-edge/stages').then(
      (module) => module.scadaEnergyEdgeStages
    ),
  'splunk-edge-processing': () =>
    import('@site/docs/integrations/splunk-edge-processing-full.stages').then(
      (module) => module.splunkEdgeProcessingStages
    ),
  'enrich-export': () =>
    import('@site/docs/log-processing/enrich-export-full.stages').then(
      (module) => module.enrichExportStages
    ),
  'filter-severity': () =>
    import('@site/docs/log-processing/filter-severity-full.stages').then(
      (module) => module.filterSeverityStages
    ),
  'production-pipeline': () =>
    import('@site/docs/log-processing/production-pipeline-full.stages').then(
      (module) => module.productionPipelineStages
    ),
};

function InlineExplorer({
  exampleId,
  title,
}: {
  exampleId: string;
  title: string;
}) {
  const [stages, setStages] = useState<readonly Stage[] | null>(null);
  const loader = explorerStageLoaders[exampleId];
  const generated = GENERATED_EXPLORER_STAGE_CONFIGS[exampleId];

  useEffect(() => {
    if (!loader || !generated) return;
    let active = true;
    void loader().then((loadedStages) => {
      if (active) setStages(loadedStages);
    });
    return () => {
      active = false;
    };
  }, [generated, loader]);

  if (!loader || !generated || !stages) return null;

  return (
    <DataPipelineExplorer
      exampleId={exampleId}
      stages={stages}
      fullYaml={generated.fullYaml}
      fullYamlFilename={generated.fullYamlFilename}
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

interface DirectSystemBoundaryProps {
  exampleId?: never;
  flows: readonly BoundaryFlow[];
  nodes: readonly BoundaryNode[];
  title?: string;
}

interface CatalogSystemBoundaryProps {
  exampleId: string;
  flows?: never;
  nodes?: never;
  title?: string;
}

type SystemBoundaryProps =
  | DirectSystemBoundaryProps
  | CatalogSystemBoundaryProps;

export interface SystemBoundaryProjection {
  flows: readonly BoundaryFlow[];
  nodes: readonly BoundaryNode[];
}

export function resolveSystemBoundaryProjection(
  props: SystemBoundaryProps
): SystemBoundaryProjection {
  if (props.exampleId) {
    return getCatalogOverviewProjection(props.exampleId).boundary;
  }

  return { nodes: props.nodes, flows: props.flows };
}

export function SystemBoundary(props: SystemBoundaryProps) {
  const { flows, nodes } = resolveSystemBoundaryProjection(props);
  const title = props.title ?? 'System boundary';
  const titleId = useId();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <figure className={styles.boundary} aria-labelledby={titleId}>
      <figcaption id={titleId}>{title}</figcaption>
      <ul className={styles.boundaryNodes} aria-label="Systems">
        {nodes.map((node) => (
          <li
            className={styles.boundaryNode}
            data-kind={node.kind}
            key={node.id}
          >
            <span>{node.label}</span>
            <small>{node.location}</small>
          </li>
        ))}
      </ul>
      <ol className={styles.boundaryFlows} aria-label="Data flows">
        {flows.map((flow) => {
          const source = nodeById.get(flow.from);
          const destination = nodeById.get(flow.to);
          return (
            <li key={`${flow.from}-${flow.to}-${flow.payload}`}>
              <span>{source?.label ?? flow.from}</span>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
              <span>{destination?.label ?? flow.to}</span>
              <small>{flow.payload}</small>
              <strong data-crosses-boundary={flow.crossesBoundary}>
                {flow.crossesBoundary ? 'Crosses boundary' : 'Stays local'}
              </strong>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

interface LimitationsProps {
  children: ReactNode;
  title?: string;
}

export function Limitations({
  children: _children,
  title: _title = 'Limitations and assumptions',
}: LimitationsProps) {
  return null;
}

export type {
  BoundaryFlow,
  BoundaryNode,
  ExampleAction,
  ExamplePageMeta,
} from './types';
