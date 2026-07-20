import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 4-Stage Schema Enforcement Pipeline
 * Demonstrates JSON Schema validation patterns:
 * 1. Original - No validation, accepts any malformed JSON
 * 2. Define Schema - JSON Schema with required fields and types
 * 3. Validate & Route - Valid messages pass, invalid routed to DLQ
 * 4. Monitor Quality - Track validation metrics and schema violations
 */

export const enforceSchemaStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original - No Validation
  // ============================================================================
  {
    id: 1,
    slug: 'no-validation',
    title: 'No Validation',
    description:
      'Start with authored records that include missing fields, unexpected types, and out-of-range values.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "not-a-valid-timestamp",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '"readings": {', indent: 1 },
      {
        content: '"temperature_celsius": "twenty-three",',
        indent: 2,
        key: 'temperature_celsius',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"humidity_percent": 150',
        indent: 2,
        key: 'humidity_percent',
        valueType: 'number',
        type: 'highlighted',
      },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '❌ Downstream Impact:', indent: 0, type: 'highlighted' },
      { content: 'Analytics: data parse failures', indent: 1 },
      { content: 'Alerts: false positives from bad values', indent: 1 },
      { content: 'Dashboard: "NaN" appears in graphs', indent: 1 },
      { content: 'ML Models: training on corrupted data', indent: 1 },
      { content: '', indent: 0 },
      { content: '❌ Malformed Data Stored:', indent: 0, type: 'highlighted' },
      { content: '"timestamp": "not-a-valid-timestamp"', indent: 1 },
      { content: '"temperature_celsius": "twenty-three"', indent: 1 },
      { content: '"humidity_percent": 150 (impossible!)', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 2: Define JSON Schema
  // ============================================================================
  {
    id: 2,
    slug: 'define-json-schema',
    title: 'Define JSON Schema',
    description:
      'Define the required fields, types, and ranges in the example JSON Schema.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "not-a-valid-timestamp",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '"readings": {', indent: 1 },
      {
        content: '"temperature_celsius": "twenty-three",',
        indent: 2,
        key: 'temperature_celsius',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"humidity_percent": 150',
        indent: 2,
        key: 'humidity_percent',
        valueType: 'number',
        type: 'highlighted',
      },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Schema Defined:', indent: 0, type: 'highlighted' },
      { content: 'required: [sensor_id, timestamp, readings]', indent: 1 },
      { content: 'timestamp: must be ISO 8601 date-time', indent: 1 },
      { content: 'temperature_celsius: -50 to 100', indent: 1 },
      { content: 'humidity_percent: 0 to 100', indent: 1 },
      { content: '', indent: 0 },
      { content: '❌ Validation Result:', indent: 0, type: 'highlighted' },
      { content: 'FAILED: timestamp format invalid', indent: 1 },
      { content: 'FAILED: temperature_celsius not a number', indent: 1 },
      { content: 'FAILED: humidity_percent > 100', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 3: Validate & Route to DLQ
  // ============================================================================
  {
    id: 3,
    slug: 'validate-route',
    title: 'Validate & Route',
    description:
      'Route matching and rejected records to separate named outputs for inspection.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "not-a-valid-timestamp",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '"readings": {', indent: 1 },
      {
        content: '"temperature_celsius": "twenty-three",',
        indent: 2,
        key: 'temperature_celsius',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"humidity_percent": 150',
        indent: 2,
        key: 'humidity_percent',
        valueType: 'number',
        type: 'highlighted',
      },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Routing Decision:', indent: 0, type: 'highlighted' },
      { content: 'status: "invalid"', indent: 1 },
      { content: 'destination: sensor-data-dlq', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ DLQ Message:', indent: 0, type: 'highlighted' },
      { content: '{', indent: 1 },
      { content: '"sensor_id": "sensor-42",', indent: 2 },
      { content: '"status": "invalid",', indent: 2 },
      { content: '"error": "schema validation failed:",', indent: 2 },
      { content: '"details": [', indent: 2 },
      { content: '"timestamp: format must be date-time",', indent: 3 },
      { content: '"temperature_celsius: must be number",', indent: 3 },
      { content: '"humidity_percent: maximum is 100"', indent: 3 },
      { content: ']', indent: 2 },
      { content: '}', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 4: Monitor Quality Metrics
  // ============================================================================
  {
    id: 4,
    slug: 'monitor-quality',
    title: 'Monitor Quality',
    description:
      'Illustrate metadata and metrics fields that a deployment could connect to its own observability system.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "not-a-valid-timestamp",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '"readings": {', indent: 1 },
      {
        content: '"temperature_celsius": "twenty-three",',
        indent: 2,
        key: 'temperature_celsius',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"humidity_percent": 150',
        indent: 2,
        key: 'humidity_percent',
        valueType: 'number',
        type: 'highlighted',
      },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      {
        content: '📊 Quality Metrics Emitted:',
        indent: 0,
        type: 'highlighted',
      },
      { content: 'schema_validation_failure{', indent: 1 },
      { content: 'sensor_id="sensor-42"', indent: 2 },
      { content: 'error_type="timestamp_format_invalid"', indent: 2 },
      { content: '} 1', indent: 1 },
      { content: '', indent: 0 },
      { content: '📈 Prometheus Dashboard:', indent: 0, type: 'highlighted' },
      { content: 'Validation summary: illustrative', indent: 1 },
      { content: 'Top Failing Sensors: sensor-42 (15 failures)', indent: 1 },
      { content: 'Common Errors: timestamp_format', indent: 1 },
      { content: '               temperature_type', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Alert Triggered:', indent: 0, type: 'highlighted' },
      { content: 'sensor-42: >10 failures in 5 min', indent: 1 },
      { content: 'Action: investigate firmware bug', indent: 1 },
    ],
  },
];
