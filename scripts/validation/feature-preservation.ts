import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { pipelineConfigOf } from './inventory';
import { isYamlObject, type YamlValue } from './yaml-value';

export const PRE_SWEEP_BASELINE =
  'd167350ffad085c267b1bbe884c5b28b6f95d03b' as const;

const PIPELINE_PATHS = [
  'examples',
  'static/files',
  'static/pipelines',
  'docs',
] as const;

const CONNECTOR_KEYS = new Set([
  'amqp_0_9',
  'amqp_1',
  'aws_kinesis',
  'aws_s3',
  'azure_blob_storage',
  'azure_cosmos_db',
  'bigquery',
  'broker',
  'command',
  'discord',
  'elasticsearch',
  'fallback',
  'file',
  'generate',
  'gcp_cloud_storage',
  'gcp_pubsub',
  'http_client',
  'http_server',
  'kafka',
  'mongodb',
  'mqtt',
  'nats',
  'nsq',
  'opensearch',
  'redis_list',
  'redis_streams',
  'retry',
  'snowflake_put',
  'splunk_hec',
  'sql_insert',
  'sql_raw',
  'sql_select',
  'stdout',
  'switch',
  'websocket',
]);

export type FeatureKind =
  | 'connector'
  | 'environment'
  | 'field'
  | 'guard'
  | 'metadata'
  | 'protected-field';

export interface SemanticFeature {
  kind: FeatureKind;
  value: string;
}

export interface FeatureException extends SemanticFeature {
  path: string;
  reason: string;
}

/**
 * Allowed losses must be executor compatibility changes, not documentation
 * simplifications. Keep each exception tied to one path and one semantic
 * feature so a broader regression cannot hide behind it.
 */
const OPENSEARCH_REPLACEMENTS = [
  'examples/data-routing/complete-fan-out.yaml',
  'examples/data-routing/content-routing.yaml',
  'examples/data-routing/fan-out-complete.yaml',
  'examples/data-routing/fan-out-pattern-complete.yaml',
  'examples/data-routing/fan-out-pattern.yaml',
  'examples/explorer-stages/fan-out-pattern/05-elasticsearch-search-analytics.yaml',
  'examples/log-processing/production-pipeline.yaml',
  'static/files/data-routing/content-routing.yaml',
  'static/files/log-processing/production-pipeline.yaml',
] as const;

export const FEATURE_EXCEPTIONS: readonly FeatureException[] = [
  ...OPENSEARCH_REPLACEMENTS.flatMap((path) =>
    ['any:elasticsearch', 'output:elasticsearch'].map((value) => ({
      path,
      kind: 'connector' as const,
      value,
      reason:
        'Expanso Edge v2.1.22 provides the OpenSearch output used at the same route; the Elasticsearch connector is unavailable.',
    }))
  ),
  {
    path: 'examples/log-processing/enrich-export-complete.yaml',
    kind: 'environment',
    value: 'GENERATE_COUNT',
    reason:
      'Expanso Edge v2.1.22 rejects environment substitution in the numeric generate.count field; interval remains configurable.',
  },
  {
    path: 'examples/log-processing/enrich-export-complete.yaml',
    kind: 'environment',
    value: 'BATCH_COUNT',
    reason:
      'Expanso Edge v2.1.22 rejects environment substitution in the numeric S3 batching.count field; period remains configurable.',
  },
  {
    path: 'examples/log-processing/enrich-export-complete.yaml',
    kind: 'environment',
    value: 'BATCH_SIZE',
    reason:
      'Expanso Edge v2.1.22 rejects environment substitution in the numeric S3 batching.byte_size field; period remains configurable.',
  },
  {
    path: 'examples/data-transformation/transform-formats-complete.yaml',
    kind: 'connector',
    value: 'output:http_server',
    reason:
      'Expanso Edge v2.1.22 returns HTTP responses with the sync_response output attached to the http_server input.',
  },
  ...['any:switch', 'output:switch'].map((value) => ({
    path: 'examples/log-processing/production-pipeline-complete.yaml',
    kind: 'connector' as const,
    value,
    reason:
      'Expanso Edge v2.1.22 applies equivalent per-output processor filters inside the fan-out broker instead of nesting switch outputs.',
  })),
];

export interface PreservationFailure extends SemanticFeature {
  path: string;
}

export interface PreservationResult {
  changedPipelines: readonly string[];
  checked: number;
  exceptions: readonly FeatureException[];
  failures: readonly PreservationFailure[];
}

function git(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function baselineSource(repositoryRoot: string, path: string): string | null {
  try {
    return git(repositoryRoot, ['show', `${PRE_SWEEP_BASELINE}:${path}`]);
  } catch {
    return null;
  }
}

function changedYamlPaths(repositoryRoot: string): string[] {
  const output = git(repositoryRoot, [
    'diff',
    '--name-only',
    '--diff-filter=ACDMRT',
    `${PRE_SWEEP_BASELINE}..HEAD`,
    '--',
    ...PIPELINE_PATHS,
  ]);

  return output
    .split('\n')
    .filter((path) => /\.(yaml|yml)$/.test(path))
    .sort();
}

function addFeature(
  features: Map<string, SemanticFeature>,
  kind: FeatureKind,
  value: string
): void {
  const normalized = value.replace(/\[(?:\d+)\]/g, '[]').trim();

  if (normalized.length === 0) return;
  features.set(`${kind}:${normalized}`, { kind, value: normalized });
}

function fieldPath(value: string): string {
  return value
    .replace(/^\./, '')
    .replace(/^(?:catch|contains|exists|or|string|type)$/, '')
    .replace(
      /\.(?:catch|contains|encrypt_aes|exists|hash|or|replace_all_regex|string|type)$/,
      ''
    );
}

function inspectScalar(
  features: Map<string, SemanticFeature>,
  value: string,
  inspectMapping: boolean
): void {
  for (const match of value.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?::[^}]*)?\}/g))
    addFeature(features, 'environment', match[1]);

  for (const match of value.matchAll(/\benv\(["']([A-Z][A-Z0-9_]*)["']\)/g))
    addFeature(features, 'environment', match[1]);

  for (const match of value.matchAll(
    /\bmeta(?:\(["']([^"']+)["']\)|\s+([A-Za-z_][A-Za-z0-9_]*))\s*=/g
  ))
    addFeature(features, 'metadata', match[1] ?? match[2]);

  for (const match of value.matchAll(/\bmeta\(["']([^"']+)["']\)/g))
    addFeature(features, 'metadata', match[1]);

  if (!inspectMapping) return;

  for (const match of value.matchAll(
    /\broot((?:\.[A-Za-z_][A-Za-z0-9_]*)+)\s*=/g
  ))
    addFeature(features, 'field', fieldPath(match[1]));

  for (const match of value.matchAll(
    /(?:^|[{,])\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*:/gm
  ))
    addFeature(features, 'field', match[1]);

  for (const match of value.matchAll(
    /\bif\s+(?:root|this)((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g
  ))
    addFeature(features, 'guard', fieldPath(match[1]));

  for (const match of value.matchAll(
    /\b(?:root|this)\.exists\(["']([^"']+)["']\)/g
  ))
    addFeature(features, 'guard', match[1]);

  for (const match of value.matchAll(
    /\b(?:root|this)((?:\.[A-Za-z_][A-Za-z0-9_]*)+)\.(?:or|catch)\(/g
  ))
    addFeature(features, 'guard', fieldPath(match[1]));

  for (const line of value.split('\n')) {
    if (!/(?:encrypt|hash\(|redact|mask|deleted\(\))/i.test(line)) continue;

    for (const match of line.matchAll(
      /\b(?:root|this)((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g
    ))
      addFeature(features, 'protected-field', fieldPath(match[1]));
  }
}

function inspectValue(
  features: Map<string, SemanticFeature>,
  value: YamlValue,
  path: readonly string[] = [],
  inspectMapping = false
): void {
  if (typeof value === 'string') {
    inspectScalar(features, value, inspectMapping);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectValue(features, item, [...path, `[${index}]`], inspectMapping)
    );
    return;
  }

  if (!isYamlObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    const root = childPath[0];

    if ((root === 'input' || root === 'output') && CONNECTOR_KEYS.has(key)) {
      addFeature(features, 'connector', `${root}:${key}`);
      addFeature(features, 'connector', `any:${key}`);
    }

    if (/(?:encrypted|redacted|masked|hash)$/i.test(key))
      addFeature(features, 'protected-field', childPath.join('.'));

    inspectValue(
      features,
      child,
      childPath,
      /^(?:check|condition|mapping|postmap|premap|request_map|result_map)$/.test(
        key
      ) && !path.includes('catch')
    );
  }
}

function inspectRecoveredSource(
  features: Map<string, SemanticFeature>,
  source: string
): void {
  inspectScalar(features, source, false);
  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^(\s*)(?:check|condition|mapping|postmap|premap|request_map|result_map):\s*(?:[|>-]\s*)?(.*)$/
    );

    if (!match) continue;
    const indentation = match[1].length;
    const block = [match[2]];

    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (next.trim().length > 0 && next.search(/\S/) <= indentation) break;
      block.push(next);
      index += 1;
    }

    inspectScalar(features, block.join('\n'), true);
  }
}

export function semanticFeatures(source: string): SemanticFeature[] {
  let document: YamlValue;

  try {
    document = parseYaml(source, {
      strict: true,
      uniqueKeys: true,
    }) as YamlValue;
  } catch {
    const recovered = new Map<string, SemanticFeature>();
    inspectRecoveredSource(recovered, source);

    for (const match of source.matchAll(/^\s*([a-z][a-z0-9_]*):\s*$/gm)) {
      if (CONNECTOR_KEYS.has(match[1]))
        addFeature(recovered, 'connector', `any:${match[1]}`);
    }

    return [...recovered.values()].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.value.localeCompare(right.value)
    );
  }

  const config = pipelineConfigOf(document);

  if (!config || config.input === undefined || config.output === undefined)
    return [];

  const features = new Map<string, SemanticFeature>();
  inspectValue(features, config);

  return [...features.values()].sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.value.localeCompare(right.value)
  );
}

function isExcepted(failure: PreservationFailure): boolean {
  return FEATURE_EXCEPTIONS.some(
    (exception) =>
      exception.path === failure.path &&
      exception.kind === failure.kind &&
      exception.value === failure.value
  );
}

export function compareFeaturePreservation(
  repositoryRoot: string
): PreservationResult {
  const changedPipelines = changedYamlPaths(repositoryRoot);
  const failures: PreservationFailure[] = [];
  let checked = 0;

  for (const path of changedPipelines) {
    const baseline = baselineSource(repositoryRoot, path);

    if (baseline === null) continue;
    const baselineFeatures = semanticFeatures(baseline);

    if (baselineFeatures.length === 0) continue;
    checked += 1;

    const currentPath = join(repositoryRoot, path);
    const currentFeatures = existsSync(currentPath)
      ? semanticFeatures(readFileSync(currentPath, 'utf8'))
      : [];
    const currentKeys = new Set(
      currentFeatures.map((feature) => `${feature.kind}:${feature.value}`)
    );

    for (const feature of baselineFeatures) {
      if (currentKeys.has(`${feature.kind}:${feature.value}`)) continue;

      const failure = { path, ...feature };
      if (!isExcepted(failure)) failures.push(failure);
    }
  }

  return {
    changedPipelines,
    checked,
    exceptions: FEATURE_EXCEPTIONS,
    failures,
  };
}

export function formatPreservationFailures(
  failures: readonly PreservationFailure[]
): string {
  return failures
    .map((failure) => `${failure.path}: ${failure.kind} ${failure.value}`)
    .join('\n');
}
