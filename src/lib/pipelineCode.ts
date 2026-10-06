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

export function isBloblangMappingSnippet(source: string): boolean {
  return /(?:^|\n)\s*(?:let\s+[a-zA-Z_]\w*\s*=|root(?:\.|\s*=))/m.test(source);
}

export function isPipelineCodeLanguage(language: string): boolean {
  return /^(?:yaml|yml|bloblang|coffee)$/i.test(language);
}

export function classifyPipelineCode(
  source: string,
  language = 'yaml'
): PipelineCodeKind | null {
  if (!source.trim()) return null;
  if (/^(?:bloblang|coffee)$/i.test(language)) return 'fragment';
  let document: ParsedYaml;

  try {
    // SAFETY: the YAML parser is configured for data-only documents, whose
    // scalar, sequence, and mapping values match ParsedYaml.
    document = parse(source, { strict: true, uniqueKeys: true }) as ParsedYaml;
  } catch {
    return isBloblangMappingSnippet(source) ? 'fragment' : null;
  }

  if (isString(document) && isBloblangMappingSnippet(source)) return 'fragment';

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

export function hasUnclassifiedExpansoCode(source: string): boolean {
  if (classifyPipelineCode(source)) return false;

  try {
    // SAFETY: the YAML parser is configured for data-only documents, whose
    // scalar, sequence, and mapping values match ParsedYaml.
    const document = parse(source, {
      strict: true,
      uniqueKeys: true,
    }) as ParsedYaml;

    return !isNonPipelineDocument(document);
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
  const fence =
    /^([ \t]*)(`{3,}|~{3,})([^\s`~]*)[^\n]*\n([\s\S]*?)^([ \t]*)\2[ \t]*$/gm;
  for (const match of page.matchAll(fence)) {
    const indentation = match[1];
    const line = page.slice(0, match.index).split('\n').length + 1;
    if (
      checkIndentation &&
      isPipelineCodeLanguage(match[3]) &&
      match[5] !== indentation
    )
      throw new Error(`Code fence indentation mismatch at line ${line - 1}`);
    blocks.push({
      source: match[4]
        .split('\n')
        .map((line) =>
          line.startsWith(indentation) ? line.slice(indentation.length) : line
        )
        .join('\n'),
      line,
      language: match[3],
    });
  }
  return blocks;
}

export function extractYamlCodeBlocks(page: string): CodeFence[] {
  return extractCodeBlocks(page).filter((block) =>
    isPipelineCodeLanguage(block.language)
  );
}
