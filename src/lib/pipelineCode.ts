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
  'processors',
  'resources',
  'processor_resources',
  'cache_resources',
  'rate_limit_resources',
]);

const PIPELINE_FRAGMENT_KEYS = new Set([
  'auth',
  'batch',
  'batching',
  'branch',
  'broker',
  'cache',
  'catch',
  'check',
  'cors',
  'dedup',
  'elasticsearch',
  'fallback',
  'gcp_cloud_storage',
  'grok',
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
  'archive',
  'bounds_check',
  'command',
  'compress',
  'decompress',
  'drop',
  'file',
  'filter',
  'for_each',
  'generate',
  'group_by',
  'group_by_value',
  'http_server',
  'json_schema',
  'log',
  'mutation',
  'parquet_encode',
  'rate_limit',
  'reject',
  'resource',
  'sleep',
  'split',
  'sql_insert',
  'stdout',
  'sync_response',
  'while',
]);

function isObject(value: ParsedYaml | undefined): value is ParsedYamlObject {
  return (
    value !== null &&
    value !== undefined &&
    !Array.isArray(value) &&
    value instanceof Object
  );
}

function isString(value: ParsedYaml): value is string {
  return value?.constructor === String;
}

export function isInfrastructureDocument(document: ParsedYaml): boolean {
  if (!isObject(document)) return false;

  if (isString(document.apiVersion) && isString(document.kind)) return true;

  if (isObject(document.services)) return true;

  return (
    Array.isArray(document.scrape_configs) ||
    Array.isArray(document.rule_files) ||
    (Array.isArray(document.groups) && !('pipeline' in document))
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

export function isBloblangMappingSnippet(source: string): boolean {
  return /(?:^|\n)\s*(?:let\s+[a-zA-Z_]\w*\s*=|root(?:\.|\s*=))/m.test(source);
}

export function isPipelineCodeLanguage(language: string): boolean {
  return /^(?:yaml|yml|bloblang)$/i.test(language);
}

export function classifyPipelineCode(
  source: string,
  language = 'yaml'
): PipelineCodeKind | null {
  if (!source.trim()) return null;
  if (/^bloblang$/i.test(language)) return 'fragment';
  let document: ParsedYaml;

  try {
    // SAFETY: the YAML parser is configured for data-only documents, whose
    // scalar, sequence, and mapping values match ParsedYaml.
    document = parse(source, { strict: true, uniqueKeys: true }) as ParsedYaml;
  } catch {
    return isBloblangMappingSnippet(source) ? 'fragment' : null;
  }

  if (isString(document) && isBloblangMappingSnippet(source)) return 'fragment';

  if (isInfrastructureDocument(document)) return null;

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

export function containsPipelineCode(source: string): boolean {
  const first =
    source
      .split('\n')
      .find((line) => line.trim() && !line.trim().startsWith('#')) ?? '';
  if (
    /^\s*(?:let\s+[a-zA-Z_]\w*\s*=|root(?:\.|\s*=)|meta(?:\s|\())/.test(first)
  )
    return true;
  try {
    const document = parse(source, {
      strict: true,
      uniqueKeys: true,
    }) as ParsedYaml;
    if (isInfrastructureDocument(document)) return false;
    const recognized = (value: ParsedYaml): boolean => {
      if (Array.isArray(value)) return value.some(recognized);
      if (!isObject(value)) return false;
      if (isObject(value.config)) return recognized(value.config);
      return Object.keys(value).some(
        (key) =>
          PIPELINE_CONTAINER_KEYS.has(key) ||
          PIPELINE_FRAGMENT_KEYS.has(key) ||
          key.endsWith('_resources')
      );
    };
    return recognized(document);
  } catch {
    return false;
  }
}

export function hasUnclassifiedExpansoCode(source: string): boolean {
  if (classifyPipelineCode(source)) return false;

  try {
    // SAFETY: the YAML parser is configured for data-only documents, whose
    // scalar, sequence, and mapping values match ParsedYaml.
    const document = parse(source, {
      strict: true,
      uniqueKeys: true,
    }) as ParsedYaml;

    return !isInfrastructureDocument(document);
  } catch {
    return true;
  }
}

export interface CodeFence {
  source: string;
  line: number;
  language: string;
}

export function extractCodeBlocks(
  page: string,
  checkIndentation = true
): CodeFence[] {
  const blocks: CodeFence[] = [];
  const lines = page.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^([ \t]*)(`{3,}|~{3,})([^\s`~]*)[^\n]*$/.exec(
      lines[index]
    );

    if (!opening) continue;
    const indentation = opening[1];
    const marker = opening[2];
    const character = marker[0];
    let closingIndex = -1;
    let closingIndentation = '';

    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      const closing = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/.exec(lines[candidate]);

      if (
        closing &&
        closing[2][0] === character &&
        closing[2].length >= marker.length
      ) {
        closingIndex = candidate;
        closingIndentation = closing[1];
        break;
      }
    }

    const hasClosingFence = closingIndex >= 0;
    if (!hasClosingFence) closingIndex = lines.length;
    const line = index + 2;
    if (
      checkIndentation &&
      hasClosingFence &&
      isPipelineCodeLanguage(opening[3]) &&
      closingIndentation !== indentation
    )
      throw new Error(`Code fence indentation mismatch at line ${line - 1}`);
    blocks.push({
      source: lines
        .slice(index + 1, closingIndex)
        .map((line) =>
          line.startsWith(indentation) ? line.slice(indentation.length) : line
        )
        .join('\n'),
      line,
      language: opening[3],
    });
    index = closingIndex;
  }
  return blocks;
}

export function extractYamlCodeBlocks(page: string): CodeFence[] {
  return extractCodeBlocks(page).filter((block) =>
    isPipelineCodeLanguage(block.language)
  );
}
