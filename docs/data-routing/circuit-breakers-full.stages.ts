import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 4-Stage Circuit Breaker Pipeline
 * Demonstrates circuit breaker patterns for resilience:
 * 1. Original - No protection from failures
 * 2. HTTP Circuit Breakers - Protect against API failures
 * 3. Database Circuit Breakers - Prevent connection pool exhaustion
 * 4. Multi-Level Fallback - Illustrative fallback branches
 */

export const circuitBreakerStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original - No Circuit Breakers
  // ============================================================================
  {
    id: 1,
    slug: 'no-circuit-breakers',
    title: 'No Circuit Breakers',
    description:
      'Authored requests before timeout, catch, or fallback configuration is added.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "temp-001",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"value": 72.5,',
        indent: 1,
        key: 'value',
        valueType: 'number',
      },
      {
        content: '"timestamp": "2024-01-15T10:00:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '❌ Request Status:', indent: 0, type: 'highlighted' },
      { content: 'timeout after 60s', indent: 1 },
      { content: 'retrying... timeout after 60s', indent: 1 },
      { content: 'retrying... timeout after 60s', indent: 1 },
      { content: '', indent: 0 },
      { content: '❌ Pipeline Status:', indent: 0, type: 'highlighted' },
      { content: 'pending_requests: 5000+', indent: 1 },
      { content: 'memory_state: authored_high', indent: 1 },
      { content: 'pipeline: BACKING UP', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 2: HTTP Circuit Breakers
  // ============================================================================
  {
    id: 2,
    slug: 'http-circuit-breakers',
    title: 'HTTP Circuit Breakers',
    description:
      'Add the example HTTP timeout and retry settings, then route processor errors through a catch branch.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "temp-001",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"value": 72.5,',
        indent: 1,
        key: 'value',
        valueType: 'number',
      },
      {
        content: '"timestamp": "2024-01-15T10:00:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Circuit Breaker:', indent: 0, type: 'highlighted' },
      { content: 'timeout: 5s (fast fail)', indent: 1 },
      { content: 'retry 1: failed', indent: 1 },
      { content: 'retry 2: failed', indent: 1 },
      { content: 'retry 3: failed', indent: 1 },
      { content: 'circuit: OPEN (stopped retrying)', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Pipeline Status:', indent: 0, type: 'highlighted' },
      { content: 'failed in 20s (was 180s+)', indent: 1 },
      { content: 'resources: PROTECTED', indent: 1 },
      { content: 'error logged to DLQ', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 3: Database Circuit Breakers
  // ============================================================================
  {
    id: 3,
    slug: 'database-circuit-breakers',
    title: 'Database Circuit Breakers',
    description:
      'Add authored connection and query bounds around the SQL branch. Runtime database behavior is not exercised.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "temp-001",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"value": 72.5,',
        indent: 1,
        key: 'value',
        valueType: 'number',
      },
      {
        content: '"timestamp": "2024-01-15T10:00:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Database Circuit:', indent: 0, type: 'highlighted' },
      { content: 'cache lookup: timeout (2s)', indent: 1 },
      { content: 'connection pool: protected', indent: 1 },
      { content: 'fallback: using default config', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Message Enriched:', indent: 0, type: 'highlighted' },
      { content: '"sensor_id": "temp-001"', indent: 1 },
      { content: '"value": 72.5', indent: 1 },
      { content: '"config": "default"', indent: 1 },
      { content: '✅ Processing continues', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 4: Multi-Level Fallback
  // ============================================================================
  {
    id: 4,
    slug: 'multi-level-fallback',
    title: 'Multi-Level Fallback',
    description:
      'Illustrate primary, secondary, local-buffer, and rejected-record branches without asserting their runtime availability or durability.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"sensor_id": "temp-001",',
        indent: 1,
        key: 'sensor_id',
        valueType: 'string',
      },
      {
        content: '"value": 72.5,',
        indent: 1,
        key: 'value',
        valueType: 'number',
      },
      {
        content: '"timestamp": "2024-01-15T10:00:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '⚡ Fallback Cascade:', indent: 0, type: 'highlighted' },
      { content: '1️⃣ Primary API: failed (timeout)', indent: 1 },
      { content: '2️⃣ Secondary API: failed (503)', indent: 1 },
      {
        content: '3️⃣ Local Buffer: SUCCESS ✅',
        indent: 1,
        type: 'highlighted',
      },
      { content: '', indent: 0 },
      { content: '✅ Result:', indent: 0, type: 'highlighted' },
      { content: 'data saved to: /var/buffer/', indent: 1 },
      { content: 'will retry when APIs recover', indent: 1 },
      { content: 'zero data loss', indent: 1 },
      { content: 'pipeline continues processing', indent: 1 },
    ],
  },
];
