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
    slug: 'single-destination',
    title: 'Single Destination',
    description:
      'Basic pipeline with single file output - the typical starting point before implementing fan-out pattern.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "sensor-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"sensor_id": "temp-sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-01-20T10:30:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"temperature": 23.5,',
        indent: 1,
        key: 'temperature',
        valueType: 'number',
      },
      {
        content: '"humidity": 65.2',
        indent: 1,
        key: 'humidity',
        valueType: 'number',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ file:', indent: 0 },
      { content: 'path: /var/data/events.jsonl', indent: 1 },
      { content: '', indent: 0 },
      {
        content: '// Single destination - no redundancy',
        indent: 0,
        type: 'comment',
      },
    ],
  },

  // ============================================================================
  // STAGE 2: Broker Fan-Out Foundation
  // ============================================================================
  {
    id: 2,
    slug: 'broker-fan-out-foundation',
    title: 'Broker Fan-Out Foundation',
    description:
      'Introduction of broker output with fan_out pattern enabling concurrent delivery to multiple destinations.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "sensor-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"sensor_id": "temp-sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-01-20T10:30:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"temperature": 23.5,',
        indent: 1,
        key: 'temperature',
        valueType: 'number',
      },
      {
        content: '"humidity": 65.2',
        indent: 1,
        key: 'humidity',
        valueType: 'number',
      },
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
    slug: 'kafka-real-time-streaming',
    title: 'Kafka Real-Time Streaming',
    description:
      'Add a Kafka branch with authored batching settings that require environment-specific tuning.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "sensor-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"sensor_id": "temp-sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-01-20T10:30:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"temperature": 23.5,',
        indent: 1,
        key: 'temperature',
        valueType: 'number',
      },
      {
        content: '"humidity": 65.2',
        indent: 1,
        key: 'humidity',
        valueType: 'number',
      },
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
    slug: 's3-long-term-archive',
    title: 'S3 Long-Term Archive',
    description:
      'Object-storage destination with authored batching and compression settings that require environment-specific review.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "sensor-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"sensor_id": "temp-sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-01-20T10:30:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"temperature": 23.5,',
        indent: 1,
        key: 'temperature',
        valueType: 'number',
      },
      {
        content: '"humidity": 65.2',
        indent: 1,
        key: 'humidity',
        valueType: 'number',
      },
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
    slug: 'elasticsearch-search-analytics',
    title: 'Elasticsearch Search & Analytics',
    description:
      'Search and analytics destination with balanced batching for near real-time indexing and operational monitoring.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "sensor-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"sensor_id": "temp-sensor-42",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-01-20T10:30:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"temperature": 23.5,',
        indent: 1,
        key: 'temperature',
        valueType: 'number',
      },
      {
        content: '"humidity": 65.2,',
        indent: 1,
        key: 'humidity',
        valueType: 'number',
      },
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
      {
        content: '  → elasticsearch: sensor-events-*',
        indent: 1,
        type: 'added',
      },
      { content: '    index: sensor-events-2025-01-20', indent: 2 },
      { content: '    id: sensor-001', indent: 2 },
      { content: '    batching: 250 msgs / 10s', indent: 2 },
    ],
  },
];
