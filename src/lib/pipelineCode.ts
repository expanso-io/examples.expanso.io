import { parse } from 'yaml';

export type PipelineCodeKind = 'fragment' | 'complete';

type ParsedYaml =
  | string
  | number
  | boolean
  | null
  | ParsedYaml[]
  | ParsedYamlObject;

interface ParsedYamlObject {
  [key: string]: ParsedYaml;
}

const PIPELINE_CONTAINER_KEYS = new Set([
  'buffer',
  'input',
  'output',
  'pipeline',
  'processor_resources',
  'cache_resources',
  'rate_limit_resources',
]);

const PIPELINE_FRAGMENT_KEYS = new Set([
  'batch',
  'batching',
  'broker',
  'cache',
  'catch',
  'check',
  'dedup',
  'elasticsearch',
  'fallback',
  'gcp_cloud_storage',
  'http',
  'http_client',
  'kafka',
  'mapping',
  'metric',
  'output',
  'outputs',
  'processors',
  'sequence',
  'sql_select',
  'switch',
  'try',
  'unarchive',
  'window',
]);

function isObject(
  value: ParsedYaml | undefined
): value is ParsedYamlObject {
  return value !== null && value !== undefined &&
    !Array.isArray(value) && value instanceof Object;
}

function isNonPipelineDocument(document: ParsedYaml): boolean {
  if (!isObject(document)) return false;

  if ('apiVersion' in document && 'kind' in document) return true;

  if ('services' in document) return true;

  return (
    'scrape_configs' in document ||
    'rule_files' in document ||
    ('global' in document && !('input' in document || 'output' in document)) ||
    ('groups' in document && !('pipeline' in document))
  );
}

function fragmentObject(document: ParsedYamlObject): boolean {
  const keys = Object.keys(document).filter(
    (key) => key !== 'label' && key !== 'name' && key !== 'type'
  );

  if (keys.some((key) => PIPELINE_CONTAINER_KEYS.has(key))) return true;

  if (keys.some((key) => key.endsWith('_resources'))) return true;

  return (
    keys.length > 0 && keys.every((key) => PIPELINE_FRAGMENT_KEYS.has(key))
  );
}

export function classifyPipelineCode(source: string): PipelineCodeKind | null {
  if (!source.trim()) return null;
  let document: ParsedYaml;

  try {
    // SAFETY: the YAML parser is configured for data-only documents, whose
    // scalar, sequence, and mapping values match ParsedYaml.
    document = parse(source, { strict: true, uniqueKeys: true }) as ParsedYaml;
  } catch {
    return null;
  }

  if (isNonPipelineDocument(document)) return null;

  if (Array.isArray(document))
    return document.length > 0 &&
      document.every((entry) => isObject(entry) && fragmentObject(entry))
      ? 'fragment'
      : null;

  if (!isObject(document)) return null;
  const config = isObject(document.config) ? document.config : document;

  if (isObject(config) && 'input' in config && 'output' in config)
    return 'complete';

  return fragmentObject(config) ? 'fragment' : null;
}

/** Detect an Expanso-shaped YAML fence that the classifier cannot place. */
export function hasUnclassifiedExpansoCode(source: string): boolean {
  if (classifyPipelineCode(source)) return false;

  try {
    // SAFETY: the YAML parser is configured for data-only documents, whose
    // scalar, sequence, and mapping values match ParsedYaml.
    const document = parse(source, {
      strict: true,
      uniqueKeys: true,
    }) as ParsedYaml;

    if (isNonPipelineDocument(document)) return false;
  } catch {
    // A malformed Expanso-shaped fence must still fail the validation gate.
  }

  const keys = [...source.matchAll(/^\s*(?:-\s*)?([a-z][a-z0-9_]*)\s*:/gm)].map(
    (match) => match[1]
  );

  return keys.some(
    (key) =>
      PIPELINE_CONTAINER_KEYS.has(key) ||
      PIPELINE_FRAGMENT_KEYS.has(key) ||
      key.endsWith('_resources')
  );
}

export function extractYamlCodeBlocks(page: string): Array<{
  source: string;
  line: number;
}> {
  const blocks: Array<{ source: string; line: number }> = [];

  const fence =
    /^([ \t]*)(`{3,}|~{3,})(?:yaml|yml)\b[^\n]*\n([\s\S]*?)^([ \t]*)\2[ \t]*$/gm;

  for (const match of page.matchAll(fence)) {
    const indentation = match[1];
    const line = page.slice(0, match.index).split('\n').length + 1;

    if (match[4] !== indentation)
      throw new Error(`YAML fence indentation mismatch at line ${line - 1}`);

    const source = match[3]
      .split('\n')
      .map((line) =>
        line.startsWith(indentation) ? line.slice(indentation.length) : line
      )
      .join('\n');

    blocks.push({
      source,
      line,
    });
  }

  return blocks;
}
