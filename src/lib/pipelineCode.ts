import { parse } from 'yaml';

export type PipelineCodeKind = 'fragment' | 'complete';

export function classifyPipelineCode(source: string): PipelineCodeKind | null {
  if (!source.trim()) return null;
  let document: unknown;
  try {
    document = parse(source, { strict: true, uniqueKeys: true });
  } catch {
    return /(?:^|\n)\s*(?:-\s*)?\w+\s*:/.test(source) ? 'fragment' : null;
  }
  if (Array.isArray(document)) return document.length ? 'fragment' : null;
  if (!document || typeof document !== 'object') return null;
  if ('apiVersion' in document && 'kind' in document) return null;
  if ('services' in document || 'volumes' in document) return null;
  const config = 'config' in document ? document.config : document;
  return config &&
    typeof config === 'object' &&
    'input' in config &&
    'output' in config
    ? 'complete'
    : 'fragment';
}

export function extractYamlCodeBlocks(page: string): Array<{
  source: string;
  line: number;
}> {
  const blocks: Array<{ source: string; line: number }> = [];
  const fence =
    /^([ \t]*)(`{3,}|~{3,})(?:yaml|yml)\b[^\n]*\n([\s\S]*?)^\1\2[ \t]*$/gm;
  for (const match of page.matchAll(fence)) {
    const indentation = match[1];
    const source = match[3]
      .split('\n')
      .map((line) =>
        line.startsWith(indentation) ? line.slice(indentation.length) : line
      )
      .join('\n');
    blocks.push({
      source,
      line: page.slice(0, match.index).split('\n').length + 1,
    });
  }
  return blocks;
}
