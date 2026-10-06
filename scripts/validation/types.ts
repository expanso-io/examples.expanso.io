/**
 * Shared types for the example pipeline validation harness.
 *
 * Every pipeline file in the repository is classified once and then carried
 * through validation, an optional local run, and the Markdown report.
 */

import type { YamlValue } from './yaml-value';

export type PipelineKind =
  | 'complete-job' // Expanso job spec: name/type plus a `config` block with input and output
  | 'complete-bare' // bare pipeline config: top-level input and output
  | 'fragment' // a partial snippet (processor list, output block, step file)
  | 'manifest' // Kubernetes or other non-pipeline YAML, never validated
  | 'invalid-yaml';

export interface PipelineFile {
  /** Repository-relative POSIX path. */
  path: string;
  kind: PipelineKind;
  /** Category directory, e.g. `data-routing`. */
  category: string;
  /** Catalog record id when the catalog points at this file, else a filename slug. */
  family: string;
  /** Parsed document (undefined for invalid YAML). */
  document?: YamlValue;
  parseError?: string;
}

export interface ValidationError {
  path?: string;
  message: string;
  suggestion?: string;
  line?: number;
  column?: number;
}

export interface ValidateResult {
  status: 'PASS' | 'FAIL';
  /** `file` validates the file as written; `wrapped` validates a fragment inside a synthetic pipeline. */
  mode: 'file' | 'wrapped';
  errors: ValidationError[];
  /** Raw validator text when the JSON output could not be parsed. */
  raw?: string;
}

export interface Substitution {
  role: 'input' | 'output' | 'processor' | 'resource';
  /** Dotted path inside the pipeline config. */
  at: string;
  from: string;
  to: string;
}

export interface RunResult {
  status: 'PASS' | 'FAIL' | 'SKIP';
  /** `native` ran the file as written; `fixture-harness` substituted inputs and outputs for local files. */
  mode?: 'native' | 'fixture-harness';
  fixture?: string;
  records?: number;
  substitutions?: Substitution[];
  reason: string;
  /** Failure diagnostics: validator message, runtime log excerpt, or timeout detail. */
  detail?: string;
  durationMs?: number;
}

export interface PipelineReport {
  file: PipelineFile;
  validate: ValidateResult;
  run?: RunResult;
}

export interface ReportSummary {
  date: string;
  edgeVersion: string;
  pinnedEdgeVersion: string;
  inventoryDigest: string;
  complete: {
    total: number;
    validatePass: number;
    validateFail: number;
    runPass: number;
    runFail: number;
    runSkip: number;
    runNotAttempted: number;
  };
  fragments: {
    total: number;
    validatePass: number;
    validateFail: number;
  };
  invalidYaml: number;
}
