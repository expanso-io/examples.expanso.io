import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const transformFormatsStages: Stage[] = [
  {
    id: 1,
    title: 'JSON Input',
    description: 'Most APIs and logs produce JSON, but JSON is inefficient for analytics: no schema enforcement, large file size (verbose keys/values), slow parsing, poor compression.',
    yamlFilename: 'step-0-json.yaml',
    yamlCode: `# JSON input (verbose, uncompressed)`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "sensor-42",', indent: 1 },
      { content: '"temperature_celsius": 23.5,', indent: 1 },
      { content: '"humidity_percent": 45.2,', indent: 1 },
      { content: '"timestamp": "2024-01-15T10:30:00Z"', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '❌ JSON Drawbacks:', indent: 0, type: 'highlighted' },
      { content: 'Size: 145 bytes (verbose keys)', indent: 1 },
      { content: 'Schema: none (typos allowed)', indent: 1 },
      { content: 'Compression: ~50% (gzip)', indent: 1 },
      { content: 'Query: full scan required', indent: 1 },
    ],
  },
  {
    id: 2,
    title: 'JSON → Avro',
    description: 'Avro enforces schema, compresses 3-5x better than JSON, and supports schema evolution (add/remove fields without breaking readers). Perfect for Kafka topics and data lakes.',
    yamlFilename: 'step-1-json-to-avro.yaml',
    yamlCode: `pipeline:
  processors:
    - avro:
        operator: to_json
        schema: |
          {
            "type": "record",
            "name": "SensorReading",
            "fields": [
              {"name": "sensor_id", "type": "string"},
              {"name": "temperature_celsius", "type": "double"},
              {"name": "humidity_percent", "type": "double"},
              {"name": "timestamp", "type": "string"}
            ]
          }`,
    inputLines: [
      { content: '{"sensor_id":"sensor-42",', indent: 0 },
      { content: '"temperature_celsius":23.5,', indent: 0 },
      { content: '"humidity_percent":45.2,', indent: 0 },
      { content: '"timestamp":"2024-01-15T10:30:00Z"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Avro Benefits:', indent: 0, type: 'highlighted' },
      { content: 'Size: 45 bytes (3x smaller)', indent: 1 },
      { content: 'Schema: enforced at write', indent: 1 },
      { content: 'Compression: ~80% (snappy)', indent: 1 },
      { content: 'Evolution: add/remove fields safely', indent: 1 },
    ],
  },
  {
    id: 3,
    title: 'Avro → Parquet',
    description: 'Parquet is a columnar format optimized for analytics: 10x faster queries (only read needed columns), 5-10x better compression, perfect for S3 data lakes and Athena/BigQuery.',
    yamlFilename: 'step-2-avro-to-parquet.yaml',
    yamlCode: `output:
  aws_s3:
    bucket: sensor-data-lake
    path: readings/\${!timestamp_unix()}.parquet
    codec: parquet
    compression: snappy
    # Columnar storage for fast analytics`,
    inputLines: [
      { content: '{"sensor_id":"sensor-42",', indent: 0 },
      { content: '"temperature_celsius":23.5,', indent: 0 },
      { content: '"humidity_percent":45.2}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Parquet Benefits:', indent: 0, type: 'highlighted' },
      { content: 'Size: 15 bytes (10x smaller)', indent: 1 },
      { content: 'Queries: 10x faster (columnar)', indent: 1 },
      { content: 'Athena: query only needed columns', indent: 1 },
      { content: 'BigQuery: native Parquet support', indent: 1 },
      { content: '', indent: 0 },
      { content: '💰 Cost Savings (1TB/month):', indent: 0, type: 'highlighted' },
      { content: 'JSON: $23/month storage + $500 query', indent: 1 },
      { content: 'Parquet: $2.30/month + $50 query', indent: 1 },
      { content: 'Savings: $470/month (90%)', indent: 1 },
    ],
  },
  {
    id: 4,
    title: 'Auto-Detection',
    description: 'Automatically detect input format (JSON, Avro, Protobuf, CSV) and apply the right transformation. Handle mixed formats from multiple data sources without manual configuration.',
    yamlFilename: 'step-3-auto-detect.yaml',
    yamlCode: `pipeline:
  processors:
    - switch:
        - check: this.type() == "object"
          processors:
            - mapping: 'root = this # JSON detected'
        - check: content().has_prefix("Obj\\x01")
          processors:
            - avro: {operator: from_json} # Avro detected
        - processors:
            - log:
                message: "Unknown format: \${!content()}"`,
    inputLines: [
      { content: 'Mixed formats:', indent: 0 },
      { content: '{"sensor_id":"sensor-42"}  (JSON)', indent: 1 },
      { content: 'Obj\\x01\\x02... (Avro)', indent: 1 },
      { content: '\\x08\\x12... (Protobuf)', indent: 1 },
    ],
    outputLines: [
      { content: '✅ Auto-Detection:', indent: 0, type: 'highlighted' },
      { content: 'JSON: parsed ✓', indent: 1 },
      { content: 'Avro: parsed ✓', indent: 1 },
      { content: 'Protobuf: parsed ✓', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Output: Unified Parquet', indent: 0, type: 'highlighted' },
      { content: 'All formats → Parquet columns', indent: 1 },
      { content: 'Ready for BigQuery/Athena', indent: 1 },
    ],
  },
];
