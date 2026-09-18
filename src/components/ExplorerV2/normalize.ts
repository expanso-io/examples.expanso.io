import type {
  CanonicallyBoundStage,
  JsonLine,
} from '../DataPipelineExplorer/types';
import type {
  ExplorerDiffState,
  ExplorerLine,
  ExplorerPayloadFormat,
  ExplorerProvenanceKind,
  ExplorerStage,
} from './types';

function lineState(
  line: JsonLine,
  comparisonMode: 'diff' | 'highlights'
): ExplorerDiffState {
  if (comparisonMode === 'highlights') {
    return line.type && !['normal', 'comment'].includes(line.type)
      ? 'changed'
      : 'unchanged';
  }
  if (line.type === 'removed') return 'removed';
  if (line.type === 'added') return 'added';
  if (line.type === 'highlighted') return 'changed';
  return 'unchanged';
}

function normalizeLine(
  line: JsonLine,
  comparisonMode: 'diff' | 'highlights'
): ExplorerLine {
  return {
    content: line.content,
    indent: line.indent,
    state: lineState(line, comparisonMode),
  };
}

export function inferPayloadFormat(
  lines: readonly JsonLine[]
): ExplorerPayloadFormat {
  const content = lines
    .map((line) => line.content.trim())
    .filter(Boolean)
    .join('\n');
  if (/^(?:base64:|(?:\\x[0-9a-f]{2}){2})/i.test(content)) return 'binary';
  if (
    /(?:^|\n)\s*(?:→|[^\n]+\s+->\s+)|\b(?:route|topic):\s*[^\n]+/i.test(content)
  ) {
    return 'route';
  }
  if (/\t/.test(content) || /^(?:[^,\n]+,){2,}[^,\n]+(?:\n|$)/.test(content)) {
    return 'tabular';
  }
  if (/^[\[{]/.test(content) || /(?:^|\n)\s*"[^"\n]+"\s*:/.test(content)) {
    return 'json';
  }
  return 'text';
}

function isExplorerStage(
  stage: ExplorerStage | CanonicallyBoundStage
): stage is ExplorerStage {
  return 'slug' in stage && 'provenance' in stage;
}

export function normalizeExplorerStages(
  stages: readonly (ExplorerStage | CanonicallyBoundStage)[],
  fallbackProvenance: ExplorerProvenanceKind,
  fallbackComparisonMode: 'diff' | 'highlights' = 'diff'
): ExplorerStage[] {
  const normalized = stages.map((stage) => {
    const comparisonMode = isExplorerStage(stage)
      ? (stage.comparisonMode ?? fallbackComparisonMode)
      : fallbackComparisonMode;
    return isExplorerStage(stage)
      ? {
          ...stage,
          inputLines: stage.inputLines.map((line) => ({
            ...line,
            state:
              comparisonMode === 'highlights' && line.state !== 'unchanged'
                ? 'changed'
                : line.state,
          })),
          outputLines: stage.outputLines.map((line) => ({
            ...line,
            state:
              comparisonMode === 'highlights' && line.state !== 'unchanged'
                ? 'changed'
                : line.state,
          })),
          inputFormat:
            stage.inputFormat ?? inferPayloadFormat(stage.inputLines),
          outputFormat:
            stage.outputFormat ?? inferPayloadFormat(stage.outputLines),
          comparisonMode,
        }
      : {
          slug: stage.slug,
          title: stage.title.replace(/^step\s+\d+\s*:\s*/i, ''),
          description: stage.description,
          inputLines: stage.inputLines.map((line) =>
            normalizeLine(line, comparisonMode)
          ),
          outputLines: stage.outputLines.map((line) =>
            normalizeLine(line, comparisonMode)
          ),
          yamlCode: stage.yamlCode,
          yamlFilename: stage.yamlFilename,
          provenance: fallbackProvenance,
          inputFormat:
            stage.inputFormat ?? inferPayloadFormat(stage.inputLines),
          outputFormat:
            stage.outputFormat ?? inferPayloadFormat(stage.outputLines),
          comparisonMode,
        };
  });
  for (const [index, stage] of normalized.entries()) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stage.slug)) {
      throw new Error(
        `Explorer stage ${index + 1} has no stable explicit slug`
      );
    }
  }
  const slugs = normalized.map((stage) => stage.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error('Explorer stage slugs must be unique');
  }
  return normalized;
}
