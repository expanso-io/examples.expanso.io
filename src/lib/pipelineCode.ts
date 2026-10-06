export type PipelineCodeKind = 'fragment' | 'complete';

export function classifyPipelineCode(source: string): PipelineCodeKind | null {
  const text = source.trim();

  if (!text) return null;

  if (/^apiVersion\s*:/m.test(text) && /^kind\s*:/m.test(text)) return null;

  if (/^(services|version)\s*:/m.test(text)) return null;

  const pipelineSyntax =
    /^(?:config|input|output|pipeline|processors|cache_resources|rate_limit_resources)\s*:/m.test(
      text
    ) ||
    /^\s*-\s+(?:mapping|branch|switch|catch|try|cache|group_by|archive|unarchive|log|http)\s*:/m.test(
      text
    );

  if (!pipelineSyntax) return null;

  const topLevelComplete =
    /^input\s*:/m.test(text) && /^output\s*:/m.test(text);

  const jobComplete =
    /^config\s*:/m.test(text) &&
    /^ {2}input\s*:/m.test(text) &&
    /^ {2}output\s*:/m.test(text);

  return topLevelComplete || jobComplete ? 'complete' : 'fragment';
}
