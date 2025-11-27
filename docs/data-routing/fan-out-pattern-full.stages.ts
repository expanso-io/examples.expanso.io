import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 5-Stage Fan-Out Pattern Pipeline
 * Demonstrates progressive multi-destination routing:
 * 1. Single Destination - Basic file output
 * 2. Broker Fan-Out Foundation - Multiple file outputs
 * 3. Kafka Real-Time Streaming - Add Kafka destination
 * 4. S3 Long-Term Archive - Add S3 destination
 * 5. Elasticsearch Search & Analytics - Complete fan-out
 */

export const fanOutPatternStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Single Destination
  // ============================================================================
  {
    id: 1,
    title: 'Single Destination',
    description: 'Basic pipeline with single file output - the typical starting point before implementing fan-out pattern.',
    yamlFilename: 'single-destination.yaml',
    yamlCode: `name: single-destination-pipeline
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  output:
    file:
      path: /var/data/events.jsonl
      codec: lines`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "sensor-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"sensor_id": "temp-sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "2025-01-20T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"temperature": 23.5,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 65.2', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ file:', indent: 0 },
      { content: 'path: /var/data/events.jsonl', indent: 1 },
      { content: '', indent: 0 },
      { content: '// Single destination - no redundancy', indent: 0, type: 'comment' },
    ],
  },

  // ============================================================================
  // STAGE 2: Broker Fan-Out Foundation
  // ============================================================================
  {
    id: 2,
    title: 'Broker Fan-Out Foundation',
    description: 'Introduction of broker output with fan_out pattern enabling concurrent delivery to multiple destinations.',
    yamlFilename: 'fan-out-foundation.yaml',
    yamlCode: `name: fan-out-foundation
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  output:
    broker:
      pattern: fan_out
      outputs:
        - file:
            path: /var/data/realtime.jsonl
            batching: {count: 100, period: 5s}
        - file:
            path: /var/data/archive.jsonl
            batching: {count: 1000, period: 30s}`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "sensor-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"sensor_id": "temp-sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "2025-01-20T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"temperature": 23.5,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 65.2', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ broker (fan_out):', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '  → file: realtime.jsonl', indent: 1, type: 'added' },
      { content: '    batching: 100 msgs / 5s', indent: 2 },
      { content: '', indent: 0 },
      { content: '  → file: archive.jsonl', indent: 1, type: 'added' },
      { content: '    batching: 1000 msgs / 30s', indent: 2 },
    ],
  },

  // ============================================================================
  // STAGE 3: Kafka Real-Time Streaming
  // ============================================================================
  {
    id: 3,
    title: 'Kafka Real-Time Streaming',
    description: 'Real-time streaming destination added with optimized batching for low-latency message delivery.',
    yamlFilename: 'kafka-fan-out.yaml',
    yamlCode: `name: kafka-fan-out
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  pipeline:
    processors:
      - mapping: |
          root = this
          root.edge_node_id = env("NODE_ID")
          root.processing_timestamp = now()

  output:
    broker:
      pattern: fan_out
      outputs:
        - kafka:
            addresses: [kafka-1.example.com:9092]
            topic: sensor-events
            key: \${!json("sensor_id")}
            batching: {count: 100, period: 2s}
            compression: snappy
        - file:
            path: /var/data/archive.jsonl
            batching: {count: 1000, period: 30s}`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "sensor-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"sensor_id": "temp-sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "2025-01-20T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"temperature": 23.5,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 65.2', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ broker (fan_out):', indent: 0 },
      { content: '', indent: 0 },
      { content: '  → kafka: sensor-events', indent: 1, type: 'added' },
      { content: '    key: temp-sensor-42', indent: 2 },
      { content: '    batching: 100 msgs / 2s', indent: 2 },
      { content: '    compression: snappy', indent: 2 },
      { content: '', indent: 0 },
      { content: '  → file: archive.jsonl', indent: 1 },
      { content: '    batching: 1000 msgs / 30s', indent: 2 },
    ],
  },

  // ============================================================================
  // STAGE 4: S3 Long-Term Archive
  // ============================================================================
  {
    id: 4,
    title: 'S3 Long-Term Archive',
    description: 'Long-term storage destination with large batches and compression for cost-efficient archival and compliance.',
    yamlFilename: 's3-fan-out.yaml',
    yamlCode: `name: s3-fan-out
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  pipeline:
    processors:
      - mapping: |
          root = this
          root.edge_node_id = env("NODE_ID")
          root.processing_timestamp = now()

  output:
    broker:
      pattern: fan_out
      outputs:
        - kafka:
            addresses: [kafka-1.example.com:9092]
            topic: sensor-events
            batching: {count: 100, period: 2s}
        - aws_s3:
            bucket: sensor-data-archive
            path: data/dt=\${!timestamp_date("2006-01-02")}/events.jsonl.gz
            batching: {count: 10000, period: 30m}
            content_encoding: gzip
            storage_class: INTELLIGENT_TIERING`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "sensor-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"sensor_id": "temp-sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "2025-01-20T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"temperature": 23.5,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 65.2', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ broker (fan_out):', indent: 0 },
      { content: '', indent: 0 },
      { content: '  → kafka: sensor-events', indent: 1 },
      { content: '    batching: 100 msgs / 2s', indent: 2 },
      { content: '', indent: 0 },
      { content: '  → aws_s3: sensor-data-archive', indent: 1, type: 'added' },
      { content: '    path: data/dt=2025-01-20/events.jsonl.gz', indent: 2 },
      { content: '    batching: 10000 msgs / 30m', indent: 2 },
      { content: '    compression: gzip', indent: 2 },
      { content: '    storage: INTELLIGENT_TIERING', indent: 2 },
    ],
  },

  // ============================================================================
  // STAGE 5: Elasticsearch Search & Analytics
  // ============================================================================
  {
    id: 5,
    title: 'Elasticsearch Search & Analytics',
    description: 'Search and analytics destination with balanced batching for near real-time indexing and operational monitoring.',
    yamlFilename: 'complete-fan-out.yaml',
    yamlCode: `name: complete-fan-out
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  pipeline:
    processors:
      - mapping: |
          root = this
          root.edge_node_id = env("NODE_ID")
          root.processing_timestamp = now()
          root.analytics = {
            "event_hour": this.timestamp.ts_hour(),
            "temp_status": if this.temperature > 35 { "high" } else { "normal" }
          }

  output:
    broker:
      pattern: fan_out
      outputs:
        - kafka:
            addresses: [kafka-1.example.com:9092]
            topic: sensor-events
            batching: {count: 100, period: 2s}
        - aws_s3:
            bucket: sensor-data-archive
            path: data/dt=\${!timestamp_date("2006-01-02")}/events.jsonl.gz
            batching: {count: 10000, period: 30m}
        - elasticsearch:
            urls: [https://es-1.example.com:9200]
            index: sensor-events-\${!timestamp_date("2006-01-02")}
            id: \${!json("event_id")}
            batching: {count: 250, period: 10s}`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "sensor-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"sensor_id": "temp-sensor-42",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"timestamp": "2025-01-20T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"temperature": 23.5,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 65.2,', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '"analytics": {', indent: 1, key: 'analytics', type: 'added' },
      { content: '  "event_hour": 10,', indent: 2 },
      { content: '  "temp_status": "normal"', indent: 2 },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ broker (fan_out):', indent: 0 },
      { content: '', indent: 0 },
      { content: '  → kafka: sensor-events', indent: 1 },
      { content: '    batching: 100 msgs / 2s', indent: 2 },
      { content: '', indent: 0 },
      { content: '  → aws_s3: sensor-data-archive', indent: 1 },
      { content: '    batching: 10000 msgs / 30m', indent: 2 },
      { content: '', indent: 0 },
      { content: '  → elasticsearch: sensor-events-*', indent: 1, type: 'added' },
      { content: '    index: sensor-events-2025-01-20', indent: 2 },
      { content: '    id: sensor-001', indent: 2 },
      { content: '    batching: 250 msgs / 10s', indent: 2 },
    ],
  },
];
