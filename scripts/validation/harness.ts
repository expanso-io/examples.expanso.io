/**
 * Build runnable job specs from example pipelines.
 *
 * Example pipelines talk to Kafka, S3, HTTP endpoints and databases. The
 * harness keeps the processing logic intact and swaps only the edges: the input
 * becomes a `file` input over a checked-in fixture, and every leaf output
 * becomes a `file` output inside a scratch directory. Routing structure
 * (`broker`, `switch`, `fallback`) and output-level processors are preserved,
 * so the run exercises the same `check` expressions the example teaches.
 *
 * Pipelines whose processors need an external service are reported as skipped
 * with the component that needs it.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { Substitution } from './types';
import {
  isNumberValue,
  isStringValue,
  isYamlObject,
  type YamlObject,
  type YamlValue,
} from './yaml-value';

/** Processors that cannot execute without a network service, database, or external binary. */
const EXTERNAL_PROCESSOR_PREFIXES = [
  'aws_',
  'gcp_',
  'azure_',
  'sql_',
  'redis',
  'nats',
  'kafka',
  'mongodb',
  'cassandra',
  'couchbase',
  'elasticsearch',
  'opensearch',
  'openai',
  'ollama',
  'cohere',
  'snowflake',
  'pinecone',
  'qdrant',
  'splunk',
  'sentry',
  'grpc',
  'mqtt',
  'amqp',
];

const EXTERNAL_PROCESSORS = new Set([
  'http',
  'command',
  'wasm',
  'workflow_remote',
]);

/** Processor containers whose nested processors must be inspected. */
const NESTED_PROCESSOR_KEYS = new Set([
  'branch',
  'try',
  'catch',
  'switch',
  'for_each',
  'group_by',
  'group_by_value',
  'parallel',
  'while',
  'workflow',
  'retry',
  'processors',
]);

const OUTPUT_META_KEYS = new Set(['processors', 'label']);

const NON_LEAF_OUTPUTS = new Set([
  'broker',
  'switch',
  'fallback',
  'retry',
  'drop',
  'reject',
  'drop_on',
]);

export interface RunnabilityVerdict {
  runnable: boolean;
  reason?: string;
}

export interface LocalStandIns {
  inputMetadata?: Readonly<Record<string, string>>;
  outputFormats?: readonly string[];
  processors?: Readonly<Record<string, YamlObject>>;
  paths?: Readonly<Record<string, { absolute: string; display: string }>>;
}

function* walkProcessors(node: YamlValue): Generator<string> {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkProcessors(item);

    return;
  }

  if (!isYamlObject(node)) return;

  for (const [key, value] of Object.entries(node)) {
    if (key === 'label') continue;

    if (NESTED_PROCESSOR_KEYS.has(key)) {
      yield* walkProcessors(value);

      if (isYamlObject(value)) {
        for (const nested of Object.values(value))
          yield* walkProcessors(nested);
      }

      continue;
    }

    if (key === 'cases' || key === 'branches') {
      yield* walkProcessors(value);
      continue;
    }

    if (
      /^[a-z][a-z0-9_]*$/.test(key) &&
      (isYamlObject(value) || Array.isArray(value) || value === null)
    ) {
      yield key;

      if (
        isYamlObject(value) &&
        (value.processors !== undefined || value.request_map !== undefined)
      ) {
        yield* walkProcessors(value.processors);
      }
    }
  }
}

function externalComponent(name: string): boolean {
  if (EXTERNAL_PROCESSORS.has(name)) return true;

  return EXTERNAL_PROCESSOR_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** Decide whether the processing logic can execute with only local resources. */
export function assessRunnability(
  config: YamlObject,
  standIns: LocalStandIns = {}
): RunnabilityVerdict {
  const pipeline =
    config.pipeline !== undefined && isYamlObject(config.pipeline)
      ? config.pipeline
      : {};

  const seen = new Set<string>();

  for (const name of walkProcessors(pipeline.processors)) seen.add(name);

  if (
    config.input !== undefined &&
    isYamlObject(config.input) &&
    config.input.processors !== undefined
  ) {
    for (const name of walkProcessors(config.input.processors)) seen.add(name);
  }

  for (const processors of outputProcessors(config.output)) {
    for (const name of walkProcessors(processors)) seen.add(name);
  }

  const processorStandIns = new Set(Object.keys(standIns.processors ?? {}));

  const blocked = [...seen].filter(
    (name) => externalComponent(name) && !processorStandIns.has(name)
  );

  if (blocked.length > 0) {
    return {
      runnable: false,
      reason: `processor needs an external service: ${blocked.join(', ')}`,
    };
  }

  for (const resourceKey of ['rate_limit_resources']) {
    const resources = config[resourceKey];

    if (!Array.isArray(resources)) continue;

    for (const resource of resources) {
      if (!isYamlObject(resource)) continue;
      const kinds = Object.keys(resource).filter((key) => key !== 'label');

      const external = kinds.filter(
        (kind) => kind !== 'memory' && kind !== 'local' && kind !== 'file'
      );

      if (external.length > 0) {
        return {
          runnable: false,
          reason: `${resourceKey} needs an external service: ${external.join(', ')}`,
        };
      }
    }
  }

  return { runnable: true };
}

function* outputProcessors(
  output: YamlValue | undefined
): Generator<YamlValue> {
  if (output === undefined || !isYamlObject(output)) return;

  if (output.processors !== undefined) yield output.processors;

  if (isYamlObject(output.broker) && Array.isArray(output.broker.outputs)) {
    for (const nested of output.broker.outputs) yield* outputProcessors(nested);
  }

  if (isYamlObject(output.switch) && Array.isArray(output.switch.cases)) {
    for (const entry of output.switch.cases)
      if (isYamlObject(entry)) yield* outputProcessors(entry.output);
  }

  if (Array.isArray(output.fallback)) {
    for (const nested of output.fallback) yield* outputProcessors(nested);
  }

  if (isYamlObject(output.retry)) yield* outputProcessors(output.retry.output);
}

export interface HarnessPlan {
  config: YamlObject;
  substitutions: Substitution[];
  /** Scratch paths every leaf output writes to. */
  outputFiles: string[];
  mode: 'native' | 'fixture-harness';
}

const LOCAL_INPUTS = new Set(['file', 'generate']);

const LOCAL_OUTPUTS = new Set(['file', 'stdout']);

const GENERATE_MAX_COUNT = 25;

/**
 * Produce the job config the harness executes.
 *
 * `fixturePath` must be absolute. `outputDir` receives one file per leaf output.
 */
export function planRun(
  original: YamlObject,
  fixturePath: string | null,
  outputDir: string,
  standIns: LocalStandIns = {}
): HarnessPlan {
  const config = structuredClone(original);
  const substitutions: Substitution[] = [];
  const outputFiles: string[] = [];
  let native = true;

  const displayFixturePath = (path: string): string => {
    const marker = '/tests/';
    const markerIndex = path.lastIndexOf(marker);

    return markerIndex >= 0
      ? path.slice(markerIndex + 1)
      : `.validation-input/${basename(path)}`;
  };

  const replaceProcessorStandIns = (node: YamlValue, at: string): YamlValue => {
    if (Array.isArray(node)) {
      return node.map((entry, index) =>
        replaceProcessorStandIns(entry, `${at}.${index}`)
      );
    }

    if (!isYamlObject(node)) return node;

    for (const [processor, replacement] of Object.entries(
      standIns.processors ?? {}
    )) {
      if (Object.hasOwn(node, processor)) {
        substitutions.push({
          role: 'processor',
          at,
          from: processor,
          to: 'deterministic mapping stub',
        });

        const localProcessor = structuredClone(replacement);

        if (isStringValue(node.label)) localProcessor.label = node.label;

        return localProcessor;
      }
    }

    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        replaceProcessorStandIns(value, `${at}.${key}`),
      ])
    );
  };

  const replacePathStandIns = (node: YamlValue, at: string): YamlValue => {
    if (Array.isArray(node)) {
      return node.map((entry, index) =>
        replacePathStandIns(entry, `${at}.${index}`)
      );
    }

    if (!isYamlObject(node)) {
      if (!isStringValue(node)) return node;
      const replacement = standIns.paths?.[node];

      if (!replacement) return node;
      substitutions.push({
        role: 'resource',
        at,
        from: node,
        to: replacement.display,
      });

      return replacement.absolute;
    }

    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        replacePathStandIns(value, `${at}.${key}`),
      ])
    );
  };

  if (
    config.pipeline !== undefined &&
    isYamlObject(config.pipeline) &&
    config.pipeline.processors !== undefined
  ) {
    config.pipeline.processors = replaceProcessorStandIns(
      config.pipeline.processors,
      'pipeline.processors'
    );
  }

  if (
    config.input !== undefined &&
    isYamlObject(config.input) &&
    config.input.processors !== undefined
  ) {
    config.input.processors = replaceProcessorStandIns(
      config.input.processors,
      'input.processors'
    );
  }

  const withLocalPaths = replacePathStandIns(config, 'config');

  if (!isYamlObject(withLocalPaths)) {
    throw new Error(
      'pipeline config became invalid while applying local path stand-ins'
    );
  }

  Object.assign(config, withLocalPaths);

  if (Array.isArray(config.cache_resources)) {
    config.cache_resources = config.cache_resources.map((resource, index) => {
      if (!isYamlObject(resource)) return resource;
      const kinds = Object.keys(resource).filter((key) => key !== 'label');

      const external = kinds.filter(
        (kind) => kind !== 'memory' && kind !== 'local' && kind !== 'file'
      );

      if (external.length === 0) return resource;
      substitutions.push({
        role: 'resource',
        at: `cache_resources.${index}`,
        from: external.join(', '),
        to: 'memory cache',
      });

      const localResource: YamlObject = {
        memory: { default_ttl: '1h' },
      };

      if (isStringValue(resource.label)) {
        localResource.label = resource.label;
      }

      return localResource;
    });
  }

  const input =
    config.input !== undefined && isYamlObject(config.input)
      ? config.input
      : {};

  const inputKind = Object.keys(input).find(
    (key) => key !== 'processors' && key !== 'label'
  );

  if (inputKind === 'generate' && isYamlObject(input.generate)) {
    const generate = input.generate;
    const count = isNumberValue(generate.count) ? generate.count : 0;

    if (count <= 0 || count > GENERATE_MAX_COUNT) {
      generate.count = GENERATE_MAX_COUNT;
      native = false;
      substitutions.push({
        role: 'input',
        at: 'input.generate.count',
        from: String(count || 'unbounded'),
        to: String(GENERATE_MAX_COUNT),
      });
    }

    if (generate.interval !== undefined && generate.interval !== '1ms') {
      substitutions.push({
        role: 'input',
        at: 'input.generate.interval',
        from: String(generate.interval),
        to: '1ms',
      });
      generate.interval = '1ms';
      native = false;
    }
  } else if (inputKind === 'file' && isYamlObject(input.file)) {
    if (!fixturePath)
      throw new Error(
        'file input needs a checked-in fixture, and none is registered'
      );
    const file = input.file;
    substitutions.push({
      role: 'input',
      at: 'input.file.paths',
      from: JSON.stringify(file.paths),
      to: displayFixturePath(fixturePath),
    });
    file.paths = [fixturePath];
    delete file.multiline;

    if (file.codec === undefined) file.codec = 'lines';
    native = false;
  } else if (fixturePath) {
    const replacement: YamlObject = {
      file: { paths: [fixturePath], codec: 'lines' },
    };

    if (input.processors !== undefined)
      replacement.processors = input.processors;
    substitutions.push({
      role: 'input',
      at: 'input',
      from: inputKind ?? 'unknown',
      to: `file (${displayFixturePath(fixturePath)})`,
    });
    config.input = replacement;
    native = false;
  } else if (!LOCAL_INPUTS.has(inputKind ?? '')) {
    throw new Error(
      `input ${inputKind ?? 'unknown'} needs a fixture, and none is registered`
    );
  }

  if (fixturePath && standIns.inputMetadata && isYamlObject(config.input)) {
    const processors = Array.isArray(config.input.processors)
      ? config.input.processors
      : [];
    config.input.processors = [
      {
        mapping: Object.entries(standIns.inputMetadata)
          .map(([key, value]) => `meta ${key} = ${JSON.stringify(value)}`)
          .join('\n'),
      },
      ...processors,
    ];
    substitutions.push({
      role: 'input',
      at: 'input.processors',
      from: 'request metadata',
      to: 'registered fixture request metadata',
    });
  }

  if (
    isYamlObject(config.buffer) &&
    isYamlObject(config.buffer.system_window) &&
    fixturePath
  ) {
    const window = config.buffer.system_window;
    window.size = window.size === '5m' ? '1500ms' : '300ms';
    if (window.slide !== undefined) window.slide = '300ms';
    const scaleWindowMappings = (node: YamlValue): YamlValue => {
      if (Array.isArray(node)) return node.map(scaleWindowMappings);
      if (!isYamlObject(node)) return node;
      return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [
          key,
          key === 'mapping' && isStringValue(value)
            ? value
                .replaceAll('let minute = 60', 'let minute = 0.3')
                .replaceAll('($end - 60)', '($end - 0.3)')
            : scaleWindowMappings(value),
        ])
      );
    };
    if (config.pipeline !== undefined)
      config.pipeline = scaleWindowMappings(config.pipeline);
    substitutions.push({
      role: 'processor',
      at: 'pipeline.processors',
      from: '60-second window arithmetic',
      to: '0.3-second window arithmetic for fixture execution',
    });
    const first = JSON.parse(
      readFileSync(fixturePath, 'utf8')
        .split('\n')
        .find((line) => line.trim()) ?? '{}'
    ) as { timestamp?: string };
    const firstTime = Date.parse(first.timestamp ?? '') / 1000;
    if (!Number.isFinite(firstTime))
      throw new Error('window fixture requires a timestamp');
    const anchor = Math.ceil((Date.now() + 1000) / 300) * 0.3 + 0.1;
    const localInput = config.input;
    if (!isYamlObject(localInput))
      throw new Error('window fixture input is missing');
    const processors = Array.isArray(localInput.processors)
      ? localInput.processors
      : [];
    localInput.processors = [
      ...processors,
      {
        mapping: `root = this\nmeta original_window_timestamp = this.timestamp\nroot.timestamp = (${anchor} + (this.timestamp.ts_parse("2006-01-02T15:04:05Z07:00").ts_unix_nano() / 1000000000 - ${firstTime}) * 0.005).ts_format("2006-01-02T15:04:05.999999999Z07:00")`,
      },
    ];
    if (config.buffer.system_window.slide !== undefined) {
      config.input = {
        sequence: {
          inputs: [
            localInput,
            {
              generate: { count: 1, mapping: 'root = {}' },
              processors: [
                { sleep: { duration: '2s' } },
                { mapping: 'root = deleted()' },
              ],
            },
          ],
        },
      };
      substitutions.push({
        role: 'input',
        at: 'input.sequence',
        from: 'fixture EOF after first window acknowledgement',
        to: 'finite input held open until overlapping windows flush',
      });
    }
    substitutions.push({
      role: 'input',
      at: 'input.processors',
      from: 'historical event timestamps',
      to: 'current timestamps at 1/200 time scale',
    });
    substitutions.push({
      role: 'resource',
      at: 'buffer.system_window',
      from: 'one-minute window unit',
      to: '300ms window unit for fixture execution',
    });
  }

  let leafIndex = 0;

  const substituteOutput = (node: YamlValue, at: string): YamlValue => {
    if (!isYamlObject(node)) return node;
    const next: YamlObject = { ...node };
    const kind = Object.keys(next).find((key) => !OUTPUT_META_KEYS.has(key));

    if (kind === undefined) return next;

    if (kind === 'broker' && isYamlObject(next.broker)) {
      const broker = { ...next.broker };
      if (
        isYamlObject(broker.batching) &&
        broker.batching.processors !== undefined
      ) {
        substitutions.push({
          role: 'output',
          at: `${at}.broker.batching`,
          from: JSON.stringify({
            count: broker.batching.count,
            period: broker.batching.period,
          }),
          to: 'count=25, period=1s; batching processors retained',
        });
        broker.batching = { ...broker.batching, count: 25, period: '1s' };
      }

      if (Array.isArray(broker.outputs)) {
        broker.outputs = broker.outputs.map((entry, index) =>
          substituteOutput(entry, `${at}.broker.outputs.${index}`)
        );
      }

      next.broker = broker;

      return next;
    }

    if (kind === 'switch' && isYamlObject(next.switch)) {
      const switchOutput = { ...next.switch };

      if (Array.isArray(switchOutput.cases)) {
        switchOutput.cases = switchOutput.cases.map((entry, index) =>
          isYamlObject(entry)
            ? {
                ...entry,
                output: substituteOutput(
                  entry.output,
                  `${at}.switch.cases.${index}.output`
                ),
              }
            : entry
        );
      }

      next.switch = switchOutput;

      return next;
    }

    if (kind === 'fallback' && Array.isArray(next.fallback)) {
      next.fallback = next.fallback.map((entry, index) =>
        substituteOutput(entry, `${at}.fallback.${index}`)
      );

      return next;
    }

    if (kind === 'retry' && isYamlObject(next.retry)) {
      next.retry = {
        ...next.retry,
        output: substituteOutput(next.retry.output, `${at}.retry.output`),
      };

      return next;
    }

    if (NON_LEAF_OUTPUTS.has(kind)) return next;

    leafIndex += 1;
    const outputName = `${String(leafIndex).padStart(2, '0')}-${kind}.jsonl`;
    const target = `${outputDir}/${outputName}`;
    const displayTarget = `.validation-output/${outputName}`;
    outputFiles.push(target);

    if (!(kind === 'file' || kind === 'stdout')) native = false;

    if (
      kind === 'file' &&
      isYamlObject(next.file) &&
      isStringValue(next.file.path)
    ) {
      substitutions.push({
        role: 'output',
        at: `${at}.file.path`,
        from: next.file.path,
        to: displayTarget,
      });
    } else {
      substitutions.push({
        role: 'output',
        at,
        from: kind,
        to: `file (${displayTarget})`,
      });
    }

    if (!LOCAL_OUTPUTS.has(kind)) native = false;
    const settings = next[kind];
    const batching =
      isYamlObject(settings) && isYamlObject(settings.batching)
        ? settings.batching
        : undefined;
    delete next[kind];
    next.file = { path: target, codec: 'lines' };
    const format = standIns.outputFormats?.[leafIndex - 1];
    if (format === 'parquet' || format === 'avro' || format === 'gzip') {
      const processors = Array.isArray(next.processors) ? next.processors : [];
      next.processors = [
        ...processors,
        format === 'parquet'
          ? { parquet_decode: {} }
          : { mapping: 'root = content().encode("base64")' },
      ];
      substitutions.push({
        role: 'output',
        at,
        from: `${format} bytes`,
        to:
          format === 'parquet'
            ? 'file after Parquet decoding'
            : 'base64 framed file',
      });
    }

    if (batching?.processors !== undefined) {
      substitutions.push({
        role: 'output',
        at: `${at}.${kind}.batching`,
        from: `count=${String(batching.count)}, period=${String(batching.period)}`,
        to: 'count=25, period=1s; batching processors retained',
      });
      return {
        broker: {
          pattern: 'fan_out',
          batching: { ...batching, count: 25, period: '1s' },
          outputs: [next],
        },
      };
    }

    return next;
  };

  if (config.output !== undefined) {
    config.output = substituteOutput(config.output, 'output');
  }

  return {
    config,
    substitutions,
    outputFiles,
    mode: native ? 'native' : 'fixture-harness',
  };
}

/**
 * Wrap a fragment in a minimal complete pipeline so the validator can check it.
 * Returns the YAML source to validate, or null when the fragment is not a
 * recognisable pipeline piece.
 */
export function wrapFragment(
  document: YamlValue | undefined,
  canonicalConfig?: YamlObject
): { source: string; description: string } | null {
  const generateInput = {
    generate: { count: 1, interval: '1s', mapping: 'root = {}' },
  };

  const dropOutput = { drop: {} };

  if (document === undefined) return null;

  if (Array.isArray(document)) {
    if (document.length === 0) return null;

    const wrapped: YamlObject = canonicalConfig
      ? structuredClone(canonicalConfig)
      : { input: generateInput, output: dropOutput };

    wrapped.pipeline = { processors: document };

    return {
      description: canonicalConfig
        ? 'processor list wrapped in its canonical pipeline context'
        : 'processor list wrapped in generate/drop pipeline',
      source: stringifyYaml(wrapped),
    };
  }

  if (!isYamlObject(document)) return null;
  const body = isYamlObject(document.config) ? document.config : document;
  const wrapped: YamlObject = canonicalConfig
    ? structuredClone(canonicalConfig)
    : {};
  const parts: string[] = [];

  for (const key of [
    'buffer',
    'cache_resources',
    'rate_limit_resources',
    'processor_resources',
  ]) {
    if (body[key] !== undefined) {
      wrapped[key] = body[key];
      parts.push(key);
    }
  }

  if (body.input !== undefined) {
    wrapped.input = body.input;
    parts.push('input');
  } else if (!canonicalConfig) {
    wrapped.input = generateInput;
  }

  if (body.pipeline !== undefined) {
    wrapped.pipeline = body.pipeline;
    parts.push('pipeline');
  } else if (Array.isArray(body.processors)) {
    wrapped.pipeline = { processors: body.processors };
    parts.push('processors');
  }

  if (body.output !== undefined) {
    wrapped.output = body.output;
    parts.push('output');
  } else if (!canonicalConfig) {
    wrapped.output = dropOutput;
  }

  if (parts.length === 0) {
    const keys = Object.keys(body).filter((key) => key !== 'label');

    if (keys.length !== 1) return null;

    return {
      description: `single component '${keys[0]}' wrapped as a processor`,
      source: stringifyYaml({
        ...(canonicalConfig ?? { input: generateInput, output: dropOutput }),
        pipeline: { processors: [body] },
      }),
    };
  }

  return {
    description:
      `${parts.join('+')} wrapped with synthetic ${parts.includes('input') ? '' : 'input'}${parts.includes('output') ? '' : ' output'}`
        .replace(/\s+/g, ' ')
        .trim(),
    source: stringifyYaml(wrapped),
  };
}

export function toYaml(value: YamlValue): string {
  return stringifyYaml(value);
}

export function fromYaml(source: string): YamlValue {
  // SAFETY: YAML snippets are parsed as data-only values and are never invoked
  // as executable JavaScript objects.
  return parseYaml(source) as YamlValue;
}
