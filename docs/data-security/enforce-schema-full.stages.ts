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
    title: 'No Validation',
    description: 'Without schema validation, malformed data reaches your analytics systems, causing downstream failures, corrupted dashboards, and broken alerts. Invalid types, missing fields, and out-of-range values pollute your data lake.',
    yamlFilename: 'step-0-no-validation.yaml',
    yamlCode: `pipeline:
  processors: []
  # ❌ No validation
  # ❌ No schema checking
  # ❌ Malformed data flows through`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "not-a-valid-timestamp",', indent: 1, key: 'timestamp', valueType: 'string', type: 'removed' },
      { content: '"readings": {', indent: 1 },
      { content: '"temperature_celsius": "twenty-three",', indent: 2, key: 'temperature_celsius', valueType: 'string', type: 'removed' },
      { content: '"humidity_percent": 150', indent: 2, key: 'humidity_percent', valueType: 'number', type: 'removed' },
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
    title: 'Define JSON Schema',
    description: 'Create a strict data contract with JSON Schema defining required fields, valid types, and acceptable ranges. Schema acts as documentation and enforcement - any data violating this contract gets rejected at the edge.',
    yamlFilename: 'step-1-define-schema.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Define JSON Schema for sensor data
        let schema = {
          "type": "object",
          "required": ["sensor_id", "timestamp", "readings"],
          "properties": {
            "sensor_id": {"type": "string"},
            "timestamp": {"type": "string", "format": "date-time"},
            "readings": {
              "type": "object",
              "required": ["temperature_celsius", "humidity_percent"],
              "properties": {
                "temperature_celsius": {"type": "number", "minimum": -50, "maximum": 100},
                "humidity_percent": {"type": "number", "minimum": 0, "maximum": 100}
              }
            }
          }
        }

        # Validate message against schema
        root = this.validate_json_schema(schema)`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string', type: 'highlighted' },
      { content: '"timestamp": "not-a-valid-timestamp",', indent: 1, key: 'timestamp', valueType: 'string', type: 'removed' },
      { content: '"readings": {', indent: 1 },
      { content: '"temperature_celsius": "twenty-three",', indent: 2, key: 'temperature_celsius', valueType: 'string', type: 'removed' },
      { content: '"humidity_percent": 150', indent: 2, key: 'humidity_percent', valueType: 'number', type: 'removed' },
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
    title: 'Validate & Route',
    description: 'Valid messages flow to analytics, invalid messages route to Dead Letter Queue (DLQ) for investigation. This prevents malformed data from corrupting downstream systems while preserving it for debugging.',
    yamlFilename: 'step-2-validate-route-dlq.yaml',
    yamlCode: `pipeline:
  processors:
    - switch:
        - check: this.validate_json_schema(schema)
          processors:
            - mapping: 'root = this.with("status", "valid")'
        - processors:
            - mapping: 'root = this.with("status", "invalid")'
            - mapping: 'root.error = error()'

output:
  switch:
    cases:
      - check: this.status == "valid"
        output:
          kafka:
            addresses: [localhost:9092]
            topic: sensor-data-valid

      - check: this.status == "invalid"
        output:
          kafka:
            addresses: [localhost:9092]
            topic: sensor-data-dlq`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "not-a-valid-timestamp",', indent: 1, key: 'timestamp', valueType: 'string', type: 'removed' },
      { content: '"readings": {', indent: 1 },
      { content: '"temperature_celsius": "twenty-three",', indent: 2, key: 'temperature_celsius', valueType: 'string', type: 'removed' },
      { content: '"humidity_percent": 150', indent: 2, key: 'humidity_percent', valueType: 'number', type: 'removed' },
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
    title: 'Monitor Quality',
    description: 'Track validation success/failure rates, common schema violations, and data quality trends. Emit metrics to detect degrading data quality from faulty devices, malicious payloads, or schema drift.',
    yamlFilename: 'step-3-monitor-quality-metrics.yaml',
    yamlCode: `pipeline:
  processors:
    - switch:
        - check: this.validate_json_schema(schema)
          processors:
            - mapping: 'root = this.with("status", "valid")'
            - metric:
                type: counter
                name: schema_validation_success
                labels:
                  sensor_id: \${! this.sensor_id }
        - processors:
            - mapping: 'root = this.with("status", "invalid")'
            - metric:
                type: counter
                name: schema_validation_failure
                labels:
                  sensor_id: \${! this.sensor_id }
                  error_type: \${! error() }

metrics:
  prometheus:
    enabled: true
    path: /metrics
  # Export validation metrics every 10s`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "not-a-valid-timestamp",', indent: 1, key: 'timestamp', valueType: 'string', type: 'removed' },
      { content: '"readings": {', indent: 1 },
      { content: '"temperature_celsius": "twenty-three",', indent: 2, key: 'temperature_celsius', valueType: 'string', type: 'removed' },
      { content: '"humidity_percent": 150', indent: 2, key: 'humidity_percent', valueType: 'number', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '📊 Quality Metrics Emitted:', indent: 0, type: 'highlighted' },
      { content: 'schema_validation_failure{', indent: 1 },
      { content: 'sensor_id="sensor-42"', indent: 2 },
      { content: 'error_type="timestamp_format_invalid"', indent: 2 },
      { content: '} 1', indent: 1 },
      { content: '', indent: 0 },
      { content: '📈 Prometheus Dashboard:', indent: 0, type: 'highlighted' },
      { content: 'Validation Success Rate: 87.3%', indent: 1 },
      { content: 'Top Failing Sensors: sensor-42 (15 failures)', indent: 1 },
      { content: 'Common Errors: timestamp_format (40%)', indent: 1 },
      { content: '                temperature_type (35%)', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Alert Triggered:', indent: 0, type: 'highlighted' },
      { content: 'sensor-42: >10 failures in 5 min', indent: 1 },
      { content: 'Action: investigate firmware bug', indent: 1 },
    ],
  },
];
