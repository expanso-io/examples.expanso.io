import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 5-Stage Content Routing Pipeline
 * Demonstrates progressive routing techniques:
 * 1. Original Input - All messages to single destination
 * 2. Severity-Based Routing - Route by alert severity
 * 3. Geographic Routing - GDPR-compliant regional routing
 * 4. Event Type Routing - Specialized processing by event type
 * 5. Priority Queue Routing - Multi-tier service levels
 */

export const contentRoutingStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original Input - Single Destination
  // ============================================================================
  {
    id: 1,
    title: 'Original Input',
    description: 'All incoming messages are sent to the same destination regardless of content, severity, region, or event type. This creates compliance risks, wastes bandwidth, and provides no service level differentiation.',
    yamlFilename: 'step-0-original.yaml',
    yamlCode: `input:
  http_server:
    address: 0.0.0.0:8080
    path: /events

output:
  kafka:
    addresses: [localhost:9092]
    topic: general-events`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "alert-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"message": "Payment processor down",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"region": "eu-west"', indent: 1, key: 'region', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "user-002",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "INFO",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "user.login",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"region": "us-east"', indent: 1, key: 'region', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "payment-003",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "WARN",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_tier": "premium",', indent: 1, key: 'user_tier', valueType: 'string' },
      { content: '"region": "eu-west"', indent: 1, key: 'region', valueType: 'string' },
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
    title: 'Severity-Based Routing',
    description: 'Route messages based on severity level. Critical alerts go to PagerDuty for immediate escalation, warnings to Slack for team awareness, and info messages to Elasticsearch for searchability. This enables proper incident response workflows.',
    yamlFilename: 'step-1-severity-routing.yaml',
    yamlCode: `output:
  switch:
    cases:
      # Critical alerts to PagerDuty
      - check: this.severity == "CRITICAL"
        output:
          http_client:
            url: https://events.pagerduty.com/v2/enqueue

      # Warnings to Slack
      - check: this.severity == "WARN"
        output:
          http_client:
            url: https://hooks.slack.com/warning

      # Default: Info to Elasticsearch
      - output:
          elasticsearch:
            index: application-logs`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "alert-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string', type: 'highlighted' },
      { content: '"message": "Payment processor down",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"region": "eu-west"', indent: 1, key: 'region', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "user-002",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "INFO",', indent: 1, key: 'severity', valueType: 'string', type: 'highlighted' },
      { content: '"event_type": "user.login",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"region": "us-east"', indent: 1, key: 'region', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "payment-003",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "WARN",', indent: 1, key: 'severity', valueType: 'string', type: 'highlighted' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_tier": "premium",', indent: 1, key: 'user_tier', valueType: 'string' },
      { content: '"region": "eu-west"', indent: 1, key: 'region', valueType: 'string' },
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
    title: 'Geographic Routing',
    description: 'Add geographic routing to maintain data residency compliance. EU data must stay in EU-based systems (GDPR requirement), while US data routes to regional clusters for optimal performance. This prevents compliance violations and reduces latency.',
    yamlFilename: 'step-2-geographic-routing.yaml',
    yamlCode: `output:
  switch:
    cases:
      # EU data to EU systems (GDPR)
      - check: this.region == "eu-west"
        output:
          broker:
            pattern: fan_out
            outputs:
              - kafka:
                  addresses: [eu-kafka.example.com:9092]
              - aws_s3:
                  bucket: eu-data-archive
                  region: eu-west-1

      # US East to regional cluster
      - check: this.region == "us-east"
        output:
          kafka:
            addresses: [us-east-kafka.example.com:9092]`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "alert-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"message": "Payment processor down",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"region": "eu-west"', indent: 1, key: 'region', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "user-002",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "INFO",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "user.login",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"region": "us-east"', indent: 1, key: 'region', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "payment-003",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "WARN",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_tier": "premium",', indent: 1, key: 'user_tier', valueType: 'string' },
      { content: '"region": "eu-west"', indent: 1, key: 'region', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ EU Systems (GDPR Compliant):', indent: 0, type: 'highlighted' },
      { content: 'kafka: eu-kafka.example.com', indent: 1 },
      { content: 's3: eu-data-archive', indent: 1 },
      { content: '✅ EU data stays in EU', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ US East Cluster:', indent: 0, type: 'highlighted' },
      { content: 'kafka: us-east-kafka.example.com', indent: 1 },
      { content: '✅ Low latency processing', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ EU Systems (GDPR Compliant):', indent: 0, type: 'highlighted' },
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
    title: 'Event Type Routing',
    description: 'Route different event types to specialized processing systems. Authentication events go to security monitoring, payment events to fraud detection with exactly-once semantics, telemetry stays local to save bandwidth, and analytics events go to the analytics API.',
    yamlFilename: 'step-3-event-type-routing.yaml',
    yamlCode: `output:
  switch:
    cases:
      # Auth events to security systems
      - check: |
          this.event_type == "user.login" ||
          this.event_type == "user.logout"
        output:
          broker:
            pattern: fan_out
            outputs:
              - http_client:
                  url: https://security-api.com/auth
              - aws_s3:
                  bucket: security-audit-logs

      # Payment events to fraud detection
      - check: this.event_type.has_prefix("payment.")
        output:
          broker:
            outputs:
              - kafka:
                  topic: payment-events
                  idempotent_write: true
              - http_client:
                  url: https://fraud-detection-api.com

      # Telemetry to local storage
      - check: this.event_type.has_prefix("telemetry.")
        output:
          file:
            path: /var/expanso/telemetry.jsonl`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "auth-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "INFO",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "user.login",', indent: 1, key: 'event_type', valueType: 'string', type: 'highlighted' },
      { content: '"region": "us-east",', indent: 1, key: 'region', valueType: 'string' },
      { content: '"ip_address": "192.168.1.1"', indent: 1, key: 'ip_address', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "payment-002",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "WARN",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string', type: 'highlighted' },
      { content: '"user_tier": "premium",', indent: 1, key: 'user_tier', valueType: 'string' },
      { content: '"region": "eu-west",', indent: 1, key: 'region', valueType: 'string' },
      { content: '"amount": 99.99', indent: 1, key: 'amount', valueType: 'number' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "telemetry-003",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "DEBUG",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "telemetry.cpu_usage",', indent: 1, key: 'event_type', valueType: 'string', type: 'highlighted' },
      { content: '"region": "us-east",', indent: 1, key: 'region', valueType: 'string' },
      { content: '"cpu_percent": 85.2', indent: 1, key: 'cpu_percent', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ Security Monitoring + Audit:', indent: 0, type: 'highlighted' },
      { content: 'http_client: security-api.com/auth', indent: 1 },
      { content: 's3: security-audit-logs (GLACIER)', indent: 1 },
      { content: '✅ Auth event security analysis', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ Fraud Detection + Payments:', indent: 0, type: 'highlighted' },
      { content: 'kafka: payment-events (exactly-once)', indent: 1 },
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
    title: 'Priority Queue Routing',
    description: 'Add priority-based routing to ensure service level differentiation. Critical priority gets immediate delivery with no batching, high priority uses small batches, normal priority uses standard batching, and low priority uses large batches to reduce overhead.',
    yamlFilename: 'step-4-priority-routing.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        root.priority = if this.priority.exists() {
          this.priority
        } else if this.severity == "CRITICAL" {
          "critical"
        } else if this.user_tier == "premium" {
          "high"
        } else {
          "normal"
        }

output:
  switch:
    cases:
      # Critical: immediate delivery
      - check: this.priority == "critical"
        output:
          kafka:
            topic: critical-queue
            batching:
              count: 1
              period: 0s

      # High: fast delivery
      - check: this.priority == "high"
        output:
          kafka:
            topic: high-priority-queue
            batching:
              count: 10
              period: 1s

      # Low: efficient batching
      - check: this.priority == "low"
        output:
          kafka:
            topic: low-priority-queue
            batching:
              count: 1000
              period: 1m`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "alert-001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"priority": "critical",', indent: 1, key: 'priority', valueType: 'string', type: 'highlighted' },
      { content: '"message": "Payment processor down"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "premium-002",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "INFO",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"user_tier": "premium",', indent: 1, key: 'user_tier', valueType: 'string' },
      { content: '"priority": "high",', indent: 1, key: 'priority', valueType: 'string', type: 'highlighted' },
      { content: '"event_type": "user.action"', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '}', indent: 0 },
      { content: '', indent: 0 },
      { content: '{', indent: 0 },
      { content: '"event_id": "batch-003",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"severity": "DEBUG",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"priority": "low",', indent: 1, key: 'priority', valueType: 'string', type: 'highlighted' },
      { content: '"event_type": "telemetry.metrics"', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '→ Critical Queue (No Batching):', indent: 0, type: 'highlighted' },
      { content: 'kafka: critical-queue', indent: 1 },
      { content: 'batch: 1 message, 0s delay', indent: 1 },
      { content: '✅ Immediate processing', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ High Priority Queue (Fast):', indent: 0, type: 'highlighted' },
      { content: 'kafka: high-priority-queue', indent: 1 },
      { content: 'batch: 10 messages, 1s delay', indent: 1 },
      { content: '✅ Premium user fast-track', indent: 1 },
      { content: '', indent: 0 },
      { content: '→ Low Priority Queue (Efficient):', indent: 0, type: 'highlighted' },
      { content: 'kafka: low-priority-queue', indent: 1 },
      { content: 'batch: 1000 messages, 1m delay', indent: 1 },
      { content: '✅ Bulk processing savings', indent: 1 },
    ],
  },
];
