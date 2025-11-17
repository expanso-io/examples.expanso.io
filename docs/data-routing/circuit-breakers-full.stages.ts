import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 4-Stage Circuit Breaker Pipeline
 * Demonstrates circuit breaker patterns for resilience:
 * 1. Original - No protection from failures
 * 2. HTTP Circuit Breakers - Protect against API failures
 * 3. Database Circuit Breakers - Prevent connection pool exhaustion
 * 4. Multi-Level Fallback - Cascade fallback for high availability
 */

export const circuitBreakerStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original - No Circuit Breakers
  // ============================================================================
  {
    id: 1,
    title: 'No Circuit Breakers',
    description: 'Without circuit breakers, a single failing downstream service can cause cascading failures, resource exhaustion, and pipeline crashes. Timeouts pile up, memory fills with pending requests, and the entire system grinds to a halt.',
    yamlFilename: 'step-0-no-protection.yaml',
    yamlCode: `output:
  # No timeouts, no retries, no fallbacks
  http_client:
    url: https://api.external.com/process
    # ❌ No timeout - waits forever
    # ❌ No retry limit - infinite retries
    # ❌ No fallback - total failure`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp-001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"value": 72.5,', indent: 1, key: 'value', valueType: 'number' },
      { content: '"timestamp": "2024-01-15T10:00:00Z"', indent: 1, key: 'timestamp', valueType: 'string' },
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
      { content: 'memory_usage: 95%', indent: 1 },
      { content: 'pipeline: BACKING UP', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 2: HTTP Circuit Breakers
  // ============================================================================
  {
    id: 2,
    title: 'HTTP Circuit Breakers',
    description: 'Fast timeouts with exponential backoff prevent infinite waiting on failed HTTP services. Circuit opens after 3 failures, protecting resources while the service recovers. 5-10x faster recovery from API failures.',
    yamlFilename: 'step-1-http-circuit-breakers.yaml',
    yamlCode: `output:
  http_client:
    url: https://api.external.com/process
    timeout: 5s           # Fast timeout
    retry_period: 1s      # Wait between retries
    max_retries: 3        # Stop after 3 failures
    backoff:
      initial_interval: 1s
      max_interval: 300s
      max_elapsed_time: 0s  # Exponential backoff`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp-001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"value": 72.5,', indent: 1, key: 'value', valueType: 'number' },
      { content: '"timestamp": "2024-01-15T10:00:00Z"', indent: 1, key: 'timestamp', valueType: 'string' },
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
    title: 'Database Circuit Breakers',
    description: 'Connection pool limits and query timeouts prevent database connection exhaustion. Maintains availability during database outages by failing fast instead of waiting for connections that will never succeed.',
    yamlFilename: 'step-2-database-circuit-breakers.yaml',
    yamlCode: `pipeline:
  processors:
    - cache:
        operator: get
        key: \${! this.sensor_id }
        # Database circuit breaker settings
        timeout: 2s          # Fast query timeout
        max_connections: 10  # Connection pool limit

    - catch:
        - log:
            message: "Cache lookup failed, using default"`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp-001",', indent: 1, key: 'sensor_id', valueType: 'string', type: 'highlighted' },
      { content: '"value": 72.5,', indent: 1, key: 'value', valueType: 'number' },
      { content: '"timestamp": "2024-01-15T10:00:00Z"', indent: 1, key: 'timestamp', valueType: 'string' },
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
    title: 'Multi-Level Fallback',
    description: 'Cascade through Primary → Secondary → Local Buffer → DLQ for 99.9%+ availability. If primary API fails, try secondary. If secondary fails, buffer locally. If buffer full, send to dead letter queue. Never lose data.',
    yamlFilename: 'step-3-multi-level-fallback.yaml',
    yamlCode: `output:
  fallback:
    # Level 1: Primary API
    - http_client:
        url: https://primary-api.com/process
        timeout: 5s
        max_retries: 2

    # Level 2: Secondary API
    - http_client:
        url: https://secondary-api.com/process
        timeout: 5s
        max_retries: 1

    # Level 3: Local buffer
    - file:
        path: /var/buffer/failed-requests.jsonl

    # Level 4: Dead letter queue
    - kafka:
        addresses: [localhost:9092]
        topic: dlq-circuit-breaker-failures`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp-001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"value": 72.5,', indent: 1, key: 'value', valueType: 'number' },
      { content: '"timestamp": "2024-01-15T10:00:00Z"', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '⚡ Fallback Cascade:', indent: 0, type: 'highlighted' },
      { content: '1️⃣ Primary API: failed (timeout)', indent: 1 },
      { content: '2️⃣ Secondary API: failed (503)', indent: 1 },
      { content: '3️⃣ Local Buffer: SUCCESS ✅', indent: 1, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '✅ Result:', indent: 0, type: 'highlighted' },
      { content: 'data saved to: /var/buffer/', indent: 1 },
      { content: 'will retry when APIs recover', indent: 1 },
      { content: 'zero data loss', indent: 1 },
      { content: 'pipeline continues processing', indent: 1 },
    ],
  },
];
