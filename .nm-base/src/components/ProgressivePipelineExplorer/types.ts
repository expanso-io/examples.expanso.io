/**
 * Types for Progressive Pipeline Explorer
 * Enables interactive step-by-step exploration of pipeline complexity
 */

export interface PipelineStage {
  /** Unique stage identifier (1-indexed) */
  id: number;

  /** Short title for this stage (shown in slider) */
  title: string;

  /** Detailed description of what this stage does */
  description: string;

  /** YAML configuration for ONLY this stage (incremental) */
  yaml: string;

  /** Output data after this stage's transformations */
  outputData: any;

  /** JSON paths that changed in this stage (for highlighting) */
  highlightPaths: string[];

  /** Optional: Fields that were removed in this stage */
  removedPaths?: string[];
}

export interface ProgressivePipelineExplorerProps {
  /** All stages for this pipeline */
  stages: PipelineStage[];

  /** Original input data (shown at top, read-only) */
  inputData: any;

  /** Optional: Title for the explorer */
  title?: string;

  /** Optional: Initial stage to display (default: 1) */
  initialStage?: number;
}

/**
 * Utility type for defining stage configurations
 */
export type StageConfig = Omit<PipelineStage, 'id'> & { id?: number };
