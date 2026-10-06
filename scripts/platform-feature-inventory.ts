import { parseAllDocuments } from 'yaml';

export const FEATURE_CATEGORIES = [
  'inputs',
  'outputs',
  'environmentControls',
  'encryptedFields',
] as const;

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number];

export type FeatureInventory = Record<FeatureCategory, string[]>;

const inputComponents = new Set([
  'aws_s3',
  'broker',
  'command',
  'csv',
  'file',
  'file_watcher',
  'generate',
  'http_client',
  'http_server',
  'kafka',
  'socket',
  'sql_select',
  'stdin',
]);

const outputComponents = new Set([
  'aws_s3',
  'broker',
  'cache',
  'drop',
  'elasticsearch',
  'fallback',
  'file',
  'gcp_bigquery',
  'gcp_cloud_storage',
  'http_client',
  'kafka',
  'reject',
  'stdout',
  'switch',
  'sync_response',
]);

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function collectComponentKeys(
  value: unknown,
  known: ReadonlySet<string>,
  result: Set<string>
): void {
  if (Array.isArray(value)) {
    for (const child of value) collectComponentKeys(child, known, result);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (known.has(key)) result.add(key);
    collectComponentKeys(child, known, result);
  }
}

function collectDirectionalComponents(
  value: unknown,
  inputs: Set<string>,
  outputs: Set<string>
): void {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectDirectionalComponents(child, inputs, outputs);
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'input') collectComponentKeys(child, inputComponents, inputs);
    if (key === 'output') {
      collectComponentKeys(child, outputComponents, outputs);
    }
    collectDirectionalComponents(child, inputs, outputs);
  }
}

function mappingStrings(value: unknown, result: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const child of value) mappingStrings(child, result);
    return result;
  }
  if (value === null || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'mapping' && typeof child === 'string') result.push(child);
    mappingStrings(child, result);
  }
  return result;
}

function fallbackComponents(
  source: string,
  known: ReadonlySet<string>
): string[] {
  const result = new Set<string>();
  const keyPattern = /^\s*(?:-\s*)?([a-zA-Z_][a-zA-Z0-9_]*):/gm;
  for (const match of source.matchAll(keyPattern)) {
    if (known.has(match[1])) result.add(match[1]);
  }
  return sorted(result);
}

export function inventoryYamlSource(source: string): FeatureInventory {
  const inputs = new Set<string>();
  const outputs = new Set<string>();
  const mappings: string[] = [];

  for (const document of parseAllDocuments(source, { strict: false })) {
    if (document.errors.length > 0 || document.contents === null) continue;
    const value = document.toJS() as unknown;
    collectDirectionalComponents(value, inputs, outputs);
    mappings.push(...mappingStrings(value));
  }

  if (inputs.size === 0 && outputs.size === 0) {
    for (const component of fallbackComponents(source, inputComponents)) {
      inputs.add(component);
    }
    for (const component of fallbackComponents(source, outputComponents)) {
      outputs.add(component);
    }
  }

  const mappingSource = mappings.join('\n');
  const environmentControls = new Set<string>();
  for (const match of source.matchAll(/\$\{([A-Z][A-Z0-9_]*)[^}]*\}/g)) {
    environmentControls.add(match[1]);
  }
  for (const match of source.matchAll(/env\(["']([A-Z][A-Z0-9_]*)["']\)/g)) {
    environmentControls.add(match[1]);
  }

  const assignedPaths = new Set<string>();
  for (const match of mappingSource.matchAll(
    /\broot((?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\s*=/g
  )) {
    const path = match[1].slice(1);
    assignedPaths.add(path);
  }

  const encryptedFields = new Set<string>();
  for (const path of assignedPaths) {
    if (/(?:^|\.)[a-zA-Z0-9_]+_encrypted$/.test(path)) {
      encryptedFields.add(path.split('.').at(-1)!);
    }
  }
  for (const match of mappingSource.matchAll(
    /["']([a-zA-Z_][a-zA-Z0-9_]*_encrypted)["']/g
  )) {
    encryptedFields.add(match[1]);
  }

  return {
    inputs: sorted(inputs),
    outputs: sorted(outputs),
    environmentControls: sorted(environmentControls),
    encryptedFields: sorted(encryptedFields),
  };
}

export function tutorialYamlBlocks(markdown: string): string[] {
  const results: string[] = [];
  const fence =
    /^([ \t]*)\x60{3}(yaml|yml|bloblang)(?:[ \t][^\n]*)?\n([\s\S]*?)^\1\x60{3}[ \t]*$/gm;
  for (const match of markdown.matchAll(fence)) {
    const nonempty = match[3].split('\n').filter((line) => line.trim());
    const indent = Math.min(
      ...nonempty.map((line) => line.match(/^[ \t]*/)![0].length)
    );
    const source = match[3]
      .split('\n')
      .map((line) => line.slice(indent))
      .join('\n');
    results.push(
      match[2] === 'bloblang'
        ? `pipeline:\n  processors:\n    - mapping: |\n${source
            .split('\n')
            .map((line) => `        ${line}`)
            .join('\n')}`
        : source
    );
  }
  return results;
}
