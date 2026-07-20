import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 5-Stage Content Routing Pipeline
 * Demonstrates progressive routing techniques:
 * 1. Original Input - All messages to single destination
 * 2. Severity-Based Routing - Route by alert severity
 * 3. Geographic Routing - region-specific routing
 * 4. Event Type Routing - Specialized processing by event type
 * 5. Priority Queue Routing - Multi-tier service levels
 */

export const contentRoutingStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original Input - Single Destination
  // ============================================================================
  {
    id: 1,
    slug: 'original-input',
    title: 'Original Input',
    description:
      'Start with one example destination before adding field-based branches.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "alert-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "CRITICAL",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"message": "Payment processor down",',
        indent: 1,
        key: 'message',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west"',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "user-002",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "INFO",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "user.login",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      {
        content: '"region": "us-east"',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "payment-003",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "WARN",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "payment.failed",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      {
        content: '"user_tier": "premium",',
        indent: 1,
        key: 'user_tier',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west"',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ kafka:', indent: 0 },
      { content: 'topic: general-events', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ kafka:', indent: 0 },
      { content: 'topic: general-events', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ kafka:', indent: 0 },
      { content: 'topic: general-events', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 2: Severity-Based Routing
  // ============================================================================
  {
    id: 2,
    slug: 'severity-based-routing',
    title: 'Severity-Based Routing',
    description:
      'Map authored severity values to named PagerDuty, Slack, and Elasticsearch branches.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "alert-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "CRITICAL",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"message": "Payment processor down",',
        indent: 1,
        key: 'message',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west"',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "user-002",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "INFO",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"event_type": "user.login",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      {
        content: '"region": "us-east"',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "payment-003",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "WARN",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"event_type": "payment.failed",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      {
        content: '"user_tier": "premium",',
        indent: 1,
        key: 'user_tier',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west"',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ http_client: (PagerDuty)', indent: 0, type: 'highlighted' },
      { content: 'url: https://events.pagerduty.com/v2/enqueue', indent: 1 },
      { content: '✅ Critical alert escalation', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ elasticsearch:', indent: 0, type: 'highlighted' },
      { content: 'index: application-logs', indent: 1 },
      { content: '✅ Searchable info logs', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ http_client: (Slack)', indent: 0, type: 'highlighted' },
      { content: 'url: https://hooks.slack.com/warning', indent: 1 },
      { content: '✅ Team warning notification', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 3: Geographic Routing
  // ============================================================================
  {
    id: 3,
    slug: 'geographic-routing',
    title: 'Geographic Routing',
    description:
      'Add a region field to the branch order. Destination labels do not establish physical location or transfer treatment.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "alert-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "CRITICAL",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"message": "Payment processor down",',
        indent: 1,
        key: 'message',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west"',
        indent: 1,
        key: 'region',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "user-002",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "INFO",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "user.login",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      {
        content: '"region": "us-east"',
        indent: 1,
        key: 'region',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "payment-003",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "WARN",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "payment.failed",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      {
        content: '"user_tier": "premium",',
        indent: 1,
        key: 'user_tier',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west"',
        indent: 1,
        key: 'region',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ EU-labeled destination:', indent: 0, type: 'highlighted' },
      { content: 'kafka: eu-kafka.example.com', indent: 1 },
      { content: 's3: eu-data-archive', indent: 1 },
      { content: '✅ EU data stays in EU', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ US East Cluster:', indent: 0, type: 'highlighted' },
      { content: 'kafka: us-east-kafka.example.com', indent: 1 },
      { content: 'Illustrative regional branch', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ EU-labeled destination:', indent: 0, type: 'highlighted' },
      { content: 'kafka: eu-kafka.example.com', indent: 1 },
      { content: 's3: eu-data-archive', indent: 1 },
      { content: '✅ EU data stays in EU', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 4: Event Type Routing
  // ============================================================================
  {
    id: 4,
    slug: 'event-type-routing',
    title: 'Event Type Routing',
    description:
      'Map authored event types to separate named branches. Delivery semantics are not exercised.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "auth-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "INFO",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "user.login",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"region": "us-east",',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      {
        content: '"ip_address": "192.168.1.1"',
        indent: 1,
        key: 'ip_address',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "payment-002",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "WARN",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "payment.failed",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"user_tier": "premium",',
        indent: 1,
        key: 'user_tier',
        valueType: 'string',
      },
      {
        content: '"region": "eu-west",',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      {
        content: '"amount": 99.99',
        indent: 1,
        key: 'amount',
        valueType: 'number',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "telemetry-003",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "DEBUG",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"event_type": "telemetry.cpu_usage",',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"region": "us-east",',
        indent: 1,
        key: 'region',
        valueType: 'string',
      },
      {
        content: '"cpu_percent": 85.2',
        indent: 1,
        key: 'cpu_percent',
        valueType: 'number',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      {
        content: '→ Security Monitoring + Audit:',
        indent: 0,
        type: 'highlighted',
      },
      { content: 'http_client: security-api.com/auth', indent: 1 },
      { content: 's3: security-audit-logs (GLACIER)', indent: 1 },
      { content: '✅ Auth event security analysis', indent: 1 },
      { content: '', indent: 0 },
      {
        content: '→ Fraud Detection + Payments:',
        indent: 0,
        type: 'highlighted',
      },
      { content: 'kafka: payment-events (configured route)', indent: 1 },
      { content: 'http_client: fraud-detection-api', indent: 1 },
      { content: '✅ Financial transaction processing', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ Local File Storage:', indent: 0, type: 'highlighted' },
      { content: 'file: /var/expanso/telemetry.jsonl', indent: 1 },
      { content: '✅ High-volume data kept local', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 5: Priority Queue Routing
  // ============================================================================
  {
    id: 5,
    slug: 'priority-queue-routing',
    title: 'Priority Queue Routing',
    description:
      'Add priority labels and authored batching settings to the branch order.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"event_id": "alert-001",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "CRITICAL",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"priority": "critical",',
        indent: 1,
        key: 'priority',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"message": "Payment processor down"',
        indent: 1,
        key: 'message',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "premium-002",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "INFO",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"user_tier": "premium",',
        indent: 1,
        key: 'user_tier',
        valueType: 'string',
      },
      {
        content: '"priority": "high",',
        indent: 1,
        key: 'priority',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"event_type": "user.action"',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      {
        content: '"event_id": "batch-003",',
        indent: 1,
        key: 'event_id',
        valueType: 'string',
      },
      {
        content: '"severity": "DEBUG",',
        indent: 1,
        key: 'severity',
        valueType: 'string',
      },
      {
        content: '"priority": "low",',
        indent: 1,
        key: 'priority',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"event_type": "telemetry.metrics"',
        indent: 1,
        key: 'event_type',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      {
        content: '→ Critical Queue (No Batching):',
        indent: 0,
        type: 'highlighted',
      },
      { content: 'kafka: critical-queue', indent: 1 },
      { content: 'batch: 1 message, 0s delay', indent: 1 },
      { content: '✅ Immediate processing', indent: 1 },
      { content: '', indent: 0 },
      {
        content: '→ High Priority Queue (Fast):',
        indent: 0,
        type: 'highlighted',
      },
      { content: 'kafka: high-priority-queue', indent: 1 },
      { content: 'batch: 10 messages, 1s delay', indent: 1 },
      { content: '✅ Premium user fast-track', indent: 1 },
      { content: '', indent: 0 },
      {
        content: '→ Low Priority Queue (Efficient):',
        indent: 0,
        type: 'highlighted',
      },
      { content: 'kafka: low-priority-queue', indent: 1 },
      { content: 'batch: 1000 messages, 1m delay', indent: 1 },
      { content: 'Illustrative bulk-processing branch', indent: 1 },
    ],
  },
];
