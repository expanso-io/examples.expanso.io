export type JsonLine = {
  content: string;
  indent: number;
  type?: 'removed' | 'highlighted' | 'normal' | 'added' | 'comment';
  key?: string;
  valueType?: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
};

export type Stage = {
  id: number;
  title: string;
  description: string;
  inputLines: JsonLine[];
  outputLines: JsonLine[];
  yamlCode: string;
  yamlFilename: string;
};

export interface DataPipelineExplorerProps {
  stages: Stage[];
  title?: string;
  subtitle?: string;
}

