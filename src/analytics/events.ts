export const ANALYTICS_EVENT_SCHEMA_VERSION = '1.0.0' as const;

export const CATALOG_ANALYTICS_FILTER_IDS = [
  'goal',
  'type',
  'boundary',
  'industry',
  'source',
  'destination',
  'difficulty',
  'status',
  'evidence',
  'interaction',
  'time',
] as const;

export type CatalogAnalyticsFilterId =
  (typeof CATALOG_ANALYTICS_FILTER_IDS)[number];

export const EXPLORER_NAVIGATION_METHODS = [
  'click',
  'keyboard',
  'previous',
  'next',
  'select',
] as const;
export type ExplorerNavigationMethod =
  (typeof EXPLORER_NAVIGATION_METHODS)[number];

export const EXPLORER_VIEWS = ['full', 'changes', 'highlights'] as const;
export type ExplorerView = (typeof EXPLORER_VIEWS)[number];

export const EXPLORER_COPY_SCOPES = [
  'stage',
  'full',
  'input',
  'output',
] as const;
export type ExplorerCopyScope = (typeof EXPLORER_COPY_SCOPES)[number];

export const EXPLORER_DOWNLOAD_SCOPES = ['stage', 'full'] as const;
export type ExplorerDownloadScope = (typeof EXPLORER_DOWNLOAD_SCOPES)[number];

export const EXAMPLE_EXECUTION_STATUSES = [
  'offline-runnable',
  'requires-integration',
  'architecture-only',
] as const;
export type ExampleExecutionStatus =
  (typeof EXAMPLE_EXECUTION_STATUSES)[number];

export const EXAMPLE_OPERATIONAL_EVIDENCE = [
  'not-assessed',
  'component-tested',
  'operating-envelope-tested',
] as const;
export type ExampleOperationalEvidence =
  (typeof EXAMPLE_OPERATIONAL_EVIDENCE)[number];

export const PUBLIC_EXAMPLE_IDS = [
  'circuit-breakers',
  'content-routing',
  'content-splitting',
  'fan-out-pattern',
  'priority-queues',
  'smart-buffering',
  'cross-border-gdpr',
  'encrypt-data',
  'encryption-patterns',
  'enforce-schema',
  'remove-pii',
  'aggregate-time-windows',
  'deduplicate-events',
  'normalize-timestamps',
  'parse-logs',
  'transform-formats',
  'db2-to-bigquery',
  'nightly-backup',
  'medical-device-intelligence',
  'motherduck-retail-analytics',
  'oran-telco-pipeline',
  'scada-energy-edge',
  'splunk-edge-processing',
  'enrich-export',
  'filter-severity',
  'production-pipeline',
] as const;

const PUBLIC_EXAMPLE_ID_SET = new Set<string>(PUBLIC_EXAMPLE_IDS);

export interface ExampleAnalyticsClassification {
  exampleId: string;
  executionStatus: ExampleExecutionStatus;
  operationalEvidence: ExampleOperationalEvidence;
}

interface AnalyticsEventBase {
  event_schema_version: typeof ANALYTICS_EVENT_SCHEMA_VERSION;
}

export interface ExampleViewEvent extends AnalyticsEventBase {
  event: 'example_view';
  example_id: string;
  execution_status: ExampleExecutionStatus;
  operational_evidence: ExampleOperationalEvidence;
}

export interface ExplorerStageViewEvent extends AnalyticsEventBase {
  event: 'explorer_stage_view';
  example_id: string;
  stage_id: string;
  navigation_method: ExplorerNavigationMethod;
}

export interface ExplorerViewToggleEvent extends AnalyticsEventBase {
  event: 'explorer_view_toggle';
  example_id: string;
  view: ExplorerView;
}

export interface PipelineCopyEvent extends AnalyticsEventBase {
  event: 'pipeline_copy';
  example_id: string;
  stage_id: string;
  scope: ExplorerCopyScope;
}

export interface PipelineDownloadEvent extends AnalyticsEventBase {
  event: 'pipeline_download';
  example_id: string;
  stage_id: string;
  scope: ExplorerDownloadScope;
}

export interface ExplorerShareEvent extends AnalyticsEventBase {
  event: 'explorer_share';
  example_id: string;
  stage_id: string;
}

export interface ExampleFilterChangeEvent extends AnalyticsEventBase {
  event: 'example_filter_change';
  filter_id: CatalogAnalyticsFilterId;
  result_count: number;
  selected_filter_ids: string[];
}

export interface ExampleSearchEvent extends AnalyticsEventBase {
  event: 'example_search';
  query_length: number;
  result_count: number;
}

export interface RunLocalClickEvent extends AnalyticsEventBase {
  event: 'run_local_click';
  example_id: string;
}

export interface RelatedExampleClickEvent extends AnalyticsEventBase {
  event: 'related_example_click';
  example_id: string;
  related_example_id: string;
}

export type PublicExampleAnalyticsEvent =
  | ExampleViewEvent
  | ExplorerStageViewEvent
  | ExplorerViewToggleEvent
  | PipelineCopyEvent
  | PipelineDownloadEvent
  | ExplorerShareEvent
  | ExampleFilterChangeEvent
  | ExampleSearchEvent
  | RunLocalClickEvent
  | RelatedExampleClickEvent;

type PublicEventName = PublicExampleAnalyticsEvent['event'];

export const PUBLIC_ANALYTICS_EVENT_NAMES = [
  'example_view',
  'explorer_stage_view',
  'explorer_view_toggle',
  'pipeline_copy',
  'pipeline_download',
  'explorer_share',
  'example_filter_change',
  'example_search',
  'run_local_click',
  'related_example_click',
] as const satisfies readonly PublicExampleAnalyticsEvent['event'][];

const EVENT_FIELDS: Readonly<Record<PublicEventName, readonly string[]>> = {
  example_view: [
    'event',
    'event_schema_version',
    'example_id',
    'execution_status',
    'operational_evidence',
  ],
  explorer_stage_view: [
    'event',
    'event_schema_version',
    'example_id',
    'stage_id',
    'navigation_method',
  ],
  explorer_view_toggle: ['event', 'event_schema_version', 'example_id', 'view'],
  pipeline_copy: [
    'event',
    'event_schema_version',
    'example_id',
    'stage_id',
    'scope',
  ],
  pipeline_download: [
    'event',
    'event_schema_version',
    'example_id',
    'stage_id',
    'scope',
  ],
  explorer_share: ['event', 'event_schema_version', 'example_id', 'stage_id'],
  example_filter_change: [
    'event',
    'event_schema_version',
    'filter_id',
    'selected_filter_ids',
    'result_count',
  ],
  example_search: [
    'event',
    'event_schema_version',
    'query_length',
    'result_count',
  ],
  run_local_click: ['event', 'event_schema_version', 'example_id'],
  related_example_click: [
    'event',
    'event_schema_version',
    'example_id',
    'related_example_id',
  ],
};

const NORMALIZED_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizedId(value: string, field: string): string {
  if (!NORMALIZED_ID_PATTERN.test(value)) {
    throw new Error(`${field} must be a normalized public id`);
  }
  return value;
}

function eventString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  return value;
}

function count(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function oneOf<const Value extends string>(
  value: Value,
  allowed: readonly Value[],
  field: string
): Value {
  if (!allowed.includes(value)) throw new Error(`${field} is not allowed`);
  return value;
}

function base(): AnalyticsEventBase {
  return { event_schema_version: ANALYTICS_EVENT_SCHEMA_VERSION };
}

export function createExampleViewEvent(
  exampleId: string,
  executionStatus: ExampleExecutionStatus,
  operationalEvidence: ExampleOperationalEvidence
): ExampleViewEvent {
  return {
    event: 'example_view',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    execution_status: oneOf(
      executionStatus,
      EXAMPLE_EXECUTION_STATUSES,
      'execution_status'
    ),
    operational_evidence: oneOf(
      operationalEvidence,
      EXAMPLE_OPERATIONAL_EVIDENCE,
      'operational_evidence'
    ),
  };
}

/** The public event id remains explorer_stage_view per the v1 migration lock. */
export function createExplorerStageChangeEvent(
  exampleId: string,
  stageId: string,
  navigationMethod: ExplorerNavigationMethod
): ExplorerStageViewEvent {
  return {
    event: 'explorer_stage_view',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    stage_id: normalizedId(stageId, 'stage_id'),
    navigation_method: oneOf(
      navigationMethod,
      EXPLORER_NAVIGATION_METHODS,
      'navigation_method'
    ),
  };
}

/** The public event id remains explorer_view_toggle per the v1 migration lock. */
export function createExplorerViewChangeEvent(
  exampleId: string,
  view: ExplorerView
): ExplorerViewToggleEvent {
  return {
    event: 'explorer_view_toggle',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    view: oneOf(view, EXPLORER_VIEWS, 'view'),
  };
}

/** The public event id remains pipeline_copy per the v1 migration lock. */
export function createExplorerCopyEvent(
  exampleId: string,
  stageId: string,
  scope: ExplorerCopyScope
): PipelineCopyEvent {
  return {
    event: 'pipeline_copy',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    stage_id: normalizedId(stageId, 'stage_id'),
    scope: oneOf(scope, EXPLORER_COPY_SCOPES, 'scope'),
  };
}

export function createPipelineDownloadEvent(
  exampleId: string,
  stageId: string,
  scope: ExplorerDownloadScope
): PipelineDownloadEvent {
  return {
    event: 'pipeline_download',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    stage_id: normalizedId(stageId, 'stage_id'),
    scope: oneOf(scope, EXPLORER_DOWNLOAD_SCOPES, 'scope'),
  };
}

export function createExplorerShareEvent(
  exampleId: string,
  stageId: string
): ExplorerShareEvent {
  return {
    event: 'explorer_share',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    stage_id: normalizedId(stageId, 'stage_id'),
  };
}

export function createExampleFilterChangeEvent(
  filterId: CatalogAnalyticsFilterId,
  selectedFilterIds: readonly string[],
  resultCount: number
): ExampleFilterChangeEvent {
  const selected = [
    ...new Set(
      selectedFilterIds.map((id) => normalizedId(id, 'selected_filter_ids'))
    ),
  ].sort();
  return {
    event: 'example_filter_change',
    ...base(),
    filter_id: oneOf(filterId, CATALOG_ANALYTICS_FILTER_IDS, 'filter_id'),
    selected_filter_ids: selected,
    result_count: count(resultCount, 'result_count'),
  };
}

export function createExampleSearchEvent(
  queryLength: number,
  resultCount: number
): ExampleSearchEvent {
  return {
    event: 'example_search',
    ...base(),
    query_length: count(queryLength, 'query_length'),
    result_count: count(resultCount, 'result_count'),
  };
}

export function createRunLocalClickEvent(
  exampleId: string
): RunLocalClickEvent {
  return {
    event: 'run_local_click',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
  };
}

export function createRelatedExampleClickEvent(
  exampleId: string,
  relatedExampleId: string
): RelatedExampleClickEvent {
  return {
    event: 'related_example_click',
    ...base(),
    example_id: normalizedId(exampleId, 'example_id'),
    related_example_id: normalizedId(relatedExampleId, 'related_example_id'),
  };
}

/**
 * Fail-closed runtime privacy guard. It makes the TypeScript union enforceable
 * at the only public dataLayer write boundary, including for JavaScript callers.
 */
export function assertPublicAnalyticsEvent(
  value: unknown
): asserts value is PublicExampleAnalyticsEvent {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('analytics event must be an object');
  }
  const event = value as Record<string, unknown>;
  if (
    typeof event.event !== 'string' ||
    !PUBLIC_ANALYTICS_EVENT_NAMES.includes(event.event as PublicEventName)
  ) {
    throw new Error('analytics event id is not public');
  }
  if (event.event_schema_version !== ANALYTICS_EVENT_SCHEMA_VERSION) {
    throw new Error('analytics event schema version is invalid');
  }
  const eventName = event.event as PublicEventName;
  const expectedFields = EVENT_FIELDS[eventName];
  const actualFields = Object.keys(event).sort();
  if (
    actualFields.length !== expectedFields.length ||
    ![...expectedFields]
      .sort()
      .every((field, index) => field === actualFields[index])
  ) {
    throw new Error(
      `${eventName} fields do not exactly match the public schema`
    );
  }

  const idFields = ['example_id', 'stage_id', 'related_example_id'] as const;
  for (const field of idFields) {
    if (field in event) {
      normalizedId(eventString(event[field], field), field);
    }
  }
  if ('filter_id' in event) {
    oneOf(
      eventString(event.filter_id, 'filter_id') as CatalogAnalyticsFilterId,
      CATALOG_ANALYTICS_FILTER_IDS,
      'filter_id'
    );
  }
  if ('selected_filter_ids' in event) {
    if (!Array.isArray(event.selected_filter_ids)) {
      throw new Error('selected_filter_ids must be an array');
    }
    const ids = event.selected_filter_ids.map((id) =>
      normalizedId(
        eventString(id, 'selected_filter_ids'),
        'selected_filter_ids'
      )
    );
    if (
      ids.length !== new Set(ids).size ||
      ids.some((id, index) => id !== [...ids].sort()[index])
    ) {
      throw new Error('selected_filter_ids must be unique and sorted');
    }
  }
  for (const field of ['query_length', 'result_count'] as const) {
    if (field in event) count(event[field] as number, field);
  }
  if ('execution_status' in event) {
    oneOf(
      eventString(
        event.execution_status,
        'execution_status'
      ) as ExampleExecutionStatus,
      EXAMPLE_EXECUTION_STATUSES,
      'execution_status'
    );
  }
  if ('operational_evidence' in event) {
    oneOf(
      eventString(
        event.operational_evidence,
        'operational_evidence'
      ) as ExampleOperationalEvidence,
      EXAMPLE_OPERATIONAL_EVIDENCE,
      'operational_evidence'
    );
  }
  if ('navigation_method' in event) {
    oneOf(
      eventString(
        event.navigation_method,
        'navigation_method'
      ) as ExplorerNavigationMethod,
      EXPLORER_NAVIGATION_METHODS,
      'navigation_method'
    );
  }
  if ('view' in event) {
    oneOf(
      eventString(event.view, 'view') as ExplorerView,
      EXPLORER_VIEWS,
      'view'
    );
  }
  if ('scope' in event) {
    const allowed =
      eventName === 'pipeline_download'
        ? EXPLORER_DOWNLOAD_SCOPES
        : EXPLORER_COPY_SCOPES;
    if (!allowed.includes(eventString(event.scope, 'scope') as never)) {
      throw new Error('scope is not allowed');
    }
  }
}

export function recordAnalyticsEvent(event: PublicExampleAnalyticsEvent): void {
  assertPublicAnalyticsEvent(event);
  if (typeof window === 'undefined') return;
  const analyticsWindow = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
  };
  analyticsWindow.dataLayer ??= [];
  analyticsWindow.dataLayer.push({ ...event });
}

export function exampleIdFromCatalogPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const candidate = segments[1];
  return candidate && PUBLIC_EXAMPLE_ID_SET.has(candidate) ? candidate : null;
}

export function exampleAnalyticsClassification(
  pathname: string
): ExampleAnalyticsClassification | null {
  const exampleId = exampleIdFromCatalogPath(pathname);
  if (exampleId === null) return null;
  return {
    exampleId,
    executionStatus:
      exampleId === 'remove-pii' ? 'offline-runnable' : 'architecture-only',
    operationalEvidence: 'not-assessed',
  };
}

export function isRunLocalPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length >= 3 && segments.at(-1) === 'setup';
}
