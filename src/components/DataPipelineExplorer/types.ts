import type { GeneratedExplorerStageFamily } from '../../catalog/explorerStageConfigs.generated';

export type JsonLine = {
  content: string;
  indent: number;
  type?: 'removed' | 'highlighted' | 'normal' | 'added' | 'comment';
  key?: string;
  valueType?: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
};

export type Stage = {
  id: number;
  slug: string;
  title: string;
  description: string;
  inputLines: JsonLine[];
  outputLines: JsonLine[];
  yamlCode?: string;
  yamlFilename?: string;
  inputFormat?: 'json' | 'text' | 'binary' | 'tabular' | 'route';
  outputFormat?: 'json' | 'text' | 'binary' | 'tabular' | 'route';
};

export type CanonicallyBoundStage = Stage & {
  yamlCode: string;
  yamlFilename: string;
};

export interface DataPipelineExplorerProps {
  exampleId: string;
  stages: readonly Stage[];
  generatedFamily: GeneratedExplorerStageFamily;
  fullYaml: string;
  fullYamlFilename: string;
  title?: string;
  subtitle?: string;
}
