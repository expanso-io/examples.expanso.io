import { useId, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import { getCatalogOverviewProjection } from '../../catalog/overviewProjection';
import type {
  BoundaryFlow,
  BoundaryNode,
  ExampleAction,
  ExamplePageMeta,
} from './types';

const executionLabels: Record<ExamplePageMeta['executionStatus'], string> = {
  'offline-runnable': 'Offline runnable',
  'requires-integration': 'Requires integration',
  'architecture-only': 'Architecture only',
};

const evidenceLabels: Record<ExamplePageMeta['operationalEvidence'], string> = {
  'not-assessed': 'Not assessed',
  'component-tested': 'Component tested',
  'operating-envelope-tested': 'Operating envelope tested',
};

interface DirectExampleHeaderProps extends ExamplePageMeta {
  eyebrow?: string;
  outcome: string;
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
  title: string;
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
  const {
    difficulty,
    executionStatus,
    expectedTime,
    operationalEvidence,
    outcome,
    title,
    verifiedAt,
  } = resolveExampleHeaderProjection(props);
  const eyebrow = props.eyebrow ?? 'Expanso example';
  const { primaryAction, secondaryAction } = props;
  const time =
    expectedTime.runMinutes !== undefined
      ? `${expectedTime.inspectMinutes} min inspect / ${expectedTime.runMinutes} min run`
      : `${expectedTime.inspectMinutes} min inspect`;

  return (
    <header className={styles.header} data-example-surface="overview">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.outcome}>{outcome}</p>
      <div className={styles.actions}>
        <a
          className={clsx('button button--primary', styles.action)}
          href={primaryAction.href}
        >
          {primaryAction.label}
        </a>
        {secondaryAction ? (
          <a
            className={clsx('button button--secondary', styles.action)}
            href={secondaryAction.href}
          >
            {secondaryAction.label}
          </a>
        ) : null}
      </div>
      <dl className={styles.meta} aria-label="Example status">
        <div>
          <dt>Execution</dt>
          <dd>{executionLabels[executionStatus]}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{evidenceLabels[operationalEvidence]}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{difficulty}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{time}</dd>
        </div>
        <div>
          <dt>Verified</dt>
          <dd>
            <time dateTime={verifiedAt}>{verifiedAt}</time>
          </dd>
        </div>
      </dl>
    </header>
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
  children,
  title = 'Limitations and assumptions',
}: LimitationsProps) {
  const titleId = useId();

  return (
    <aside className={styles.limitations} aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </aside>
  );
}

export type {
  BoundaryFlow,
  BoundaryNode,
  ExampleAction,
  ExamplePageMeta,
} from './types';
