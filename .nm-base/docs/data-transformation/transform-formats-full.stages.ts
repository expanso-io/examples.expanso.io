import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const transformFormatsStages: Stage[] = [
  {
    id: 1,
    slug: 'json-input',
    title: 'JSON Input',
    description:
      'A representative JSON record before a schema-backed encoding is selected.',
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "sensor-42",', indent: 1 },
      { content: '"temperature_celsius": 23.5,', indent: 1 },
      { content: '"humidity_percent": 45.2,', indent: 1 },
      { content: '"timestamp": "2024-01-15T10:30:00Z"', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: 'JSON review points:', indent: 0, type: 'highlighted' },
      { content: 'Field names and numeric types are explicit', indent: 1 },
      { content: 'No schema artifact is attached to this record', indent: 1 },
    ],
  },
  {
    id: 2,
    slug: 'json-avro',
    title: 'JSON → Avro',
    description:
      'Attach a representative Avro record schema and review writer-reader compatibility separately.',
    inputLines: [
      { content: '{"sensor_id":"sensor-42",', indent: 0 },
      { content: '"temperature_celsius":23.5,', indent: 0 },
      { content: '"humidity_percent":45.2,', indent: 0 },
      { content: '"timestamp":"2024-01-15T10:30:00Z"}', indent: 0 },
    ],
    outputLines: [
      { content: 'Avro review points:', indent: 0, type: 'highlighted' },
      { content: 'Schema: enforced at write', indent: 1 },
      {
        content: 'Reader compatibility requires a versioned schema policy',
        indent: 1,
      },
    ],
  },
  {
    id: 3,
    slug: 'avro-parquet',
    title: 'Avro → Parquet',
    description:
      'Configure a representative Parquet object output and review column types and partitioning.',
    inputLines: [
      { content: '{"sensor_id":"sensor-42",', indent: 0 },
      { content: '"temperature_celsius":23.5,', indent: 0 },
      { content: '"humidity_percent":45.2}', indent: 0 },
    ],
    outputLines: [
      { content: 'Parquet review points:', indent: 0, type: 'highlighted' },
      { content: 'Column types come from the configured writer', indent: 1 },
      {
        content: 'Object partitioning remains a destination decision',
        indent: 1,
      },
    ],
  },
  {
    id: 4,
    slug: 'auto-detection',
    title: 'Auto-Detection',
    description:
      'Apply the two authored checks for JSON objects and an Avro prefix, then report an unknown format.',
    inputLines: [
      { content: 'Representative inputs:', indent: 0 },
      { content: '{"sensor_id":"sensor-42"}  (JSON)', indent: 1 },
      { content: 'Obj\\x01\\x02... (Avro)', indent: 1 },
      { content: '\\x08\\x12... (unknown to this mapping)', indent: 1 },
    ],
    outputLines: [
      { content: 'Authored branch labels:', indent: 0, type: 'highlighted' },
      { content: 'JSON object: pass through mapping', indent: 1 },
      { content: 'Avro prefix: enter Avro branch', indent: 1 },
      { content: 'Other bytes: log unknown format', indent: 1 },
    ],
  },
];
