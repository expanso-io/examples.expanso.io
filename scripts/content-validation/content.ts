import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeMdx, normalizeVisibleText } from './ast';
import { findContentFiles, repositoryPath, sha256 } from './io';
import { validateContentPolicy } from './policy';
import type { ContentAnalysis, Finding, ValidationResult } from './types';

export interface ContentValidationOptions {
  repositoryRoot: string;
  inputRoot: string;
  policyPath: string;
  now?: Date;
}

export async function validateContent(
  options: ContentValidationOptions
): Promise<ValidationResult> {
  const rawPolicy = await readFile(resolve(options.policyPath), 'utf8');
  const policyDigest = sha256(rawPolicy);
  let policyValue: unknown;
  try {
    policyValue = JSON.parse(rawPolicy);
  } catch (error) {
    return result(options.now, policyDigest, 0, [
      {
        code: 'INVALID_CONTRACT',
        file: repositoryPath(options.repositoryRoot, options.policyPath),
        message: `Content policy is not valid JSON: ${messageOf(error)}`,
      },
    ]);
  }
  const policyCheck = validateContentPolicy(
    policyValue,
    repositoryPath(options.repositoryRoot, options.policyPath)
  );
  if (!policyCheck.policy) {
    return result(options.now, policyDigest, 0, policyCheck.errors);
  }

  let files: string[];
  try {
    files = await findContentFiles(options.inputRoot);
  } catch (error) {
    return result(options.now, policyDigest, 0, [
      {
        code: 'INVALID_CONTRACT',
        file: options.inputRoot,
        message: `Unable to enumerate content: ${messageOf(error)}`,
      },
    ]);
  }
  if (files.length === 0) {
    return result(options.now, policyDigest, 0, [
      {
        code: 'INVALID_CONTRACT',
        file: options.inputRoot,
        message: 'Content validator received zero Markdown/MDX files',
      },
    ]);
  }

  const analyses: ContentAnalysis[] = [];
  for (const absoluteFile of files) {
    const file = repositoryPath(options.repositoryRoot, absoluteFile);
    try {
      analyses.push(
        await analyzeMdx(
          await readFile(absoluteFile, 'utf8'),
          file,
          policyCheck.policy,
          { absoluteFile, repositoryRoot: options.repositoryRoot }
        )
      );
    } catch (error) {
      analyses.push({
        file,
        frontmatter: {},
        visibleText: '',
        blocks: [],
        wordCount: 0,
        openingWordCount: 0,
        headingCount: 0,
        headings: [],
        componentNames: [],
        hasLocalNavigation: false,
        uniqueTasks: [],
        errors: [
          {
            code: 'AST_PARSE_ERROR',
            file,
            message: `Unable to read content: ${messageOf(error)}`,
          },
        ],
      });
    }
  }

  const errors = analyses.flatMap((analysis) => analysis.errors);
  errors.push(
    ...duplicateFindings(
      analyses,
      policyCheck.policy.structure.duplicateBlockMinimumWords
    )
  );
  return {
    ...result(options.now, policyDigest, files.length, errors),
    metrics: {
      dimensionsChecked: [
        'mdx-ast-classification',
        'rendered-narrative-budget',
        'opening-before-action-budget',
        'dense-surface-structure',
        'exact-normalized-block-duplication',
      ],
      files: analyses.map((analysis) => ({
        file: analysis.file,
        archetype: analysis.frontmatter.contentArchetype ?? null,
        words: analysis.wordCount,
        openingWords: analysis.openingWordCount,
        headings: analysis.headingCount,
        narrativeBlocks: analysis.blocks.length,
      })),
    },
  };
}

function duplicateFindings(
  analyses: ContentAnalysis[],
  minimumWords: number
): Finding[] {
  const seen = new Map<
    string,
    { file: string; line?: number; words: number }
  >();
  const findings: Finding[] = [];
  const emitted = new Set<string>();
  for (const analysis of analyses) {
    for (const block of analysis.blocks) {
      if (block.words < minimumWords) {
        continue;
      }
      const normalized = normalizeVisibleText(block.text);
      const earlier = seen.get(normalized);
      if (!earlier) {
        seen.set(normalized, {
          file: analysis.file,
          line: block.line,
          words: block.words,
        });
        continue;
      }
      if (earlier.file === analysis.file) {
        continue;
      }
      const key = `${earlier.file}\0${analysis.file}\0${normalized}`;
      if (!emitted.has(key)) {
        emitted.add(key);
        findings.push({
          code: 'DUPLICATE_CONTENT',
          file: analysis.file,
          line: block.line,
          message: `${block.words}-word normalized narrative block duplicates ${earlier.file}${earlier.line ? `:${earlier.line}` : ''}`,
          detail: { duplicateOf: earlier.file, duplicateLine: earlier.line },
        });
      }
    }
  }
  return findings;
}

function result(
  now: Date | undefined,
  policyDigest: string,
  filesChecked: number,
  errors: Finding[]
): ValidationResult {
  return {
    contractVersion: '1.0.0',
    gateId: 'content-validator-v1',
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    checkedAt: (now ?? new Date()).toISOString(),
    policyDigest,
    filesChecked,
    errors,
    warnings: [],
    metrics: {},
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
