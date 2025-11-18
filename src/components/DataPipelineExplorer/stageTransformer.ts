import type { Stage, JsonLine } from './types';

/**
 * Transforms various stage data formats into the standardized Stage type
 * This handles legacy formats and converts them to the new JsonLine-based format
 */

interface LegacyStageFormat1 {
  stage?: number;
  title: string;
  description: string;
  yaml?: string;
  input: any;
  output: any;
}

interface LegacyStageFormat2 {
  title: string;
  description: string;
  inputData?: string;
  outputData?: string;
  yamlConfig?: string;
  changes?: any[];
}

type AnyStageFormat = Stage | LegacyStageFormat1 | LegacyStageFormat2 | any;

/**
 * Converts a JSON string or object to JsonLine array
 */
function parseToJsonLines(data: string | object, highlightFields: string[] = []): JsonLine[] {
  let jsonObj: any;

  if (typeof data === 'string') {
    try {
      jsonObj = JSON.parse(data);
    } catch {
      // If it's not valid JSON, treat it as text lines
      return data.split('\n').map((line, idx) => ({
        content: line,
        indent: 0,
      }));
    }
  } else {
    jsonObj = data;
  }

  const lines: JsonLine[] = [];

  function processValue(value: any, indent: number, key?: string): void {
    if (value === null) {
      lines.push({
        content: key ? `"${key}": null` : 'null',
        indent,
        key,
        valueType: 'null',
        type: highlightFields.includes(key || '') ? 'highlighted' : undefined,
      });
    } else if (typeof value === 'string') {
      lines.push({
        content: key ? `"${key}": "${value}"` : `"${value}"`,
        indent,
        key,
        valueType: 'string',
        type: highlightFields.includes(key || '') ? 'highlighted' : undefined,
      });
    } else if (typeof value === 'number') {
      lines.push({
        content: key ? `"${key}": ${value}` : `${value}`,
        indent,
        key,
        valueType: 'number',
        type: highlightFields.includes(key || '') ? 'highlighted' : undefined,
      });
    } else if (typeof value === 'boolean') {
      lines.push({
        content: key ? `"${key}": ${value}` : `${value}`,
        indent,
        key,
        valueType: 'boolean',
        type: highlightFields.includes(key || '') ? 'highlighted' : undefined,
      });
    } else if (Array.isArray(value)) {
      if (key) {
        lines.push({ content: `"${key}": [`, indent });
      } else {
        lines.push({ content: '[', indent });
      }
      value.forEach((item, idx) => {
        processValue(item, indent + 1);
        if (idx < value.length - 1) {
          const lastLine = lines[lines.length - 1];
          lastLine.content += ',';
        }
      });
      lines.push({ content: ']', indent });
    } else if (typeof value === 'object') {
      if (key) {
        lines.push({ content: `"${key}": {`, indent });
      } else {
        lines.push({ content: '{', indent });
      }
      const entries = Object.entries(value);
      entries.forEach(([k, v], idx) => {
        processValue(v, indent + 1, k);
        if (idx < entries.length - 1) {
          const lastLine = lines[lines.length - 1];
          lastLine.content += ',';
        }
      });
      lines.push({ content: '}', indent });
    }
  }

  processValue(jsonObj, 0);
  return lines;
}

/**
 * Converts text-based output (routing descriptions) to JsonLine format
 */
function parseTextToJsonLines(text: string): JsonLine[] {
  const lines = text.split('\n');
  return lines.map(line => {
    // Detect indentation level
    const trimmedLine = line.trim();
    const indent = trimmedLine.startsWith('→') ? 0 :
                   trimmedLine.startsWith('✅') ? 1 :
                   line.startsWith('  ') ? 1 : 0;

    return {
      content: trimmedLine,
      indent,
      type: trimmedLine.startsWith('→') ? 'highlighted' as const : undefined,
    };
  }).filter(line => line.content); // Remove empty lines
}

/**
 * Main transformer function
 */
export function transformToStage(data: AnyStageFormat, index: number): Stage {
  // Already in correct format
  if ('inputLines' in data && 'outputLines' in data && 'yamlCode' in data) {
    return {
      id: data.id || index + 1,
      title: data.title,
      description: data.description,
      inputLines: data.inputLines,
      outputLines: data.outputLines,
      yamlCode: data.yamlCode,
      yamlFilename: data.yamlFilename || `step-${index}.yaml`,
    };
  }

  // Format 2: inputData/outputData/yamlConfig
  if ('inputData' in data || 'outputData' in data) {
    return {
      id: index + 1,
      title: data.title,
      description: data.description,
      inputLines: data.inputData ? parseToJsonLines(data.inputData) : [],
      outputLines: data.outputData ? parseToJsonLines(data.outputData) : [],
      yamlCode: data.yamlConfig || '',
      yamlFilename: `step-${index}.yaml`,
    };
  }

  // Format 3: input/output objects with yaml
  if ('input' in data && 'output' in data) {
    return {
      id: data.stage || index + 1,
      title: data.title,
      description: data.description,
      inputLines: parseToJsonLines(data.input),
      outputLines: parseToJsonLines(data.output),
      yamlCode: data.yaml || '',
      yamlFilename: `step-${index}.yaml`,
    };
  }

  // Fallback - try to make something work
  console.warn('Unknown stage format, using fallback transformation', data);
  return {
    id: index + 1,
    title: data.title || 'Untitled Stage',
    description: data.description || '',
    inputLines: [],
    outputLines: [],
    yamlCode: '',
    yamlFilename: `step-${index}.yaml`,
  };
}

/**
 * Transform an array of any stage format to standardized Stage[]
 */
export function transformStages(stages: AnyStageFormat[]): Stage[] {
  return stages.map((stage, index) => transformToStage(stage, index));
}
