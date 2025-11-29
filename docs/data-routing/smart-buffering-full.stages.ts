import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const smartBufferingStages: Stage[] = [
  {
    id: 1,
    title: "Original Input",
    description: "All messages are buffered in FIFO order. Important alerts wait behind debug logs, payment failures queue after bulk analytics. After reconnection, all backlogged messages compete equally.",
    yamlFilename: 'foundation.yaml',
    yamlCode: `# No priority buffering - all messages treated equally
buffer:
  memory:
    limit: 50000
    batch_policy:
      count: 100      # FIFO ordering
      period: 1s      # Same delay for all

output:
  http_client:
    url: \${DESTINATION_URL}
    verb: POST
    timeout: 30s`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "important",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000', indent: 1, key: 'amount', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "important",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"buffered_at": "2024-01-15T14:30:01Z"', indent: 1, key: 'buffered_at', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Priority Classification",
    description: "Messages are classified into three tiers: important (critical alerts, payment failures), regular (standard operations), and archive (debug logs, analytics). Each tier gets a label.",
    yamlFilename: 'step-1-classify.yaml',
    yamlCode: `# Classify messages into priority tiers
pipeline:
  processors:
    - mapping: |
        root = this

        let category = this.category.or("").lowercase()
        let severity = this.severity.or("info").lowercase()
        let event_type = this.event_type.or("").lowercase()

        # Important: critical alerts, payment failures
        let is_important = match {
          category == "important" => true,
          severity == "critical" => true,
          event_type.has_prefix("payment.failed") => true,
          _ => false
        }

        # Archive: debug logs, analytics
        let is_archive = match {
          category == "archive" => true,
          severity == "debug" => true,
          _ => false
        }

        # Assign tier (1=highest, 3=lowest)
        root.priority_tier = match {
          is_important => 1,
          is_archive => 3,
          _ => 2
        }

        root.priority_label = match root.priority_tier {
          1 => "important",
          2 => "regular",
          3 => "archive"
        }`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "important",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000', indent: 1, key: 'amount', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "important",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"priority_tier": 1,', indent: 1, key: 'priority_tier', valueType: 'number', type: 'highlighted' },
      { content: '"priority_label": "important"', indent: 1, key: 'priority_label', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Priority Output Routing",
    description: "Route each tier to separate outputs with different batching. Important: count=1 (immediate). Regular: count=50. Archive: count=200. New important messages ship immediately—they don't wait for queued regular batches.",
    yamlFilename: 'step-3-priority-output.yaml',
    yamlCode: `# Route to separate outputs with tier-specific batching
output:
  switch:
    cases:
      # IMPORTANT: No batching - ship immediately
      - check: this.priority_tier == 1
        output:
          http_client:
            url: \${DESTINATION_URL}
            batching:
              count: 1      # Immediate!
              period: 0s
            max_retries: 10

      # REGULAR: Moderate batching
      - check: this.priority_tier == 2
        output:
          http_client:
            url: \${DESTINATION_URL}
            batching:
              count: 50
              period: 5s

      # ARCHIVE: Heavy batching
      - check: this.priority_tier == 3
        output:
          http_client:
            url: \${DESTINATION_URL}
            batching:
              count: 200
              period: 30s`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "important",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"priority_tier": 1,', indent: 1, key: 'priority_tier', valueType: 'number' },
      { content: '"priority_label": "important"', indent: 1, key: 'priority_label', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '// Routed to important output (count: 1)', indent: 0, type: 'comment' },
      { content: '// Ships IMMEDIATELY - no batching delay', indent: 0, type: 'comment' },
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "important",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"priority_tier": 1,', indent: 1, key: 'priority_tier', valueType: 'number' },
      { content: '"priority_label": "important",', indent: 1, key: 'priority_label', valueType: 'string' },
      { content: '"routed_to": "important_output",', indent: 1, key: 'routed_to', valueType: 'string', type: 'highlighted' },
      { content: '"batching": "count: 1, period: 0s"', indent: 1, key: 'batching', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Starvation Prevention",
    description: "Age-based boost prevents low-priority starvation. This 3-hour-old archive message gets +900 boost, escalating it to important tier. After 2 hours, even archive messages ship with important priority.",
    yamlFilename: 'step-4-starvation-prevention.yaml',
    yamlCode: `# Age-based priority escalation prevents starvation
pipeline:
  processors:
    - mapping: |
        root = this
        # ... classification logic ...

        # Calculate message age
        let message_ts = this.timestamp.parse_timestamp()
        let age_seconds = (now().unix() - message_ts.unix()).round()
        root.age_seconds = age_seconds

        # Age boost escalates old messages
        let age_boost = match {
          age_seconds > 7200 => 900,  # > 2hr: important
          age_seconds > 1800 => 400,  # > 30min: regular
          age_seconds > 300 => 100,   # > 5min: small boost
          _ => 0
        }

        # Archive (100) + age_boost (900) = 1000 (important!)
        root.priority_score = base_score + age_boost
        root.age_escalated = age_boost > 0

        # Re-classify based on boosted score
        root.priority_tier = match {
          root.priority_score >= 1000 => 1,  # Escalated!
          root.priority_score >= 500 => 2,
          _ => 3
        }`,
    inputLines: [
      { content: '// 3-hour-old archive message', indent: 0, type: 'comment' },
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T11:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "debug",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "archive",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "analytics.pageview",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "web-frontend",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Old debug log"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '// ESCALATED to important tier!', indent: 0, type: 'comment' },
      { content: '// Ships with count: 1 (immediate)', indent: 0, type: 'comment' },
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T11:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "debug",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"category": "archive",', indent: 1, key: 'category', valueType: 'string' },
      { content: '"event_type": "analytics.pageview",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"service": "web-frontend",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Old debug log",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"age_seconds": 10800,', indent: 1, key: 'age_seconds', valueType: 'number', type: 'highlighted' },
      { content: '"age_boost": 900,', indent: 1, key: 'age_boost', valueType: 'number', type: 'highlighted' },
      { content: '"priority_score": 1000,', indent: 1, key: 'priority_score', valueType: 'number', type: 'highlighted' },
      { content: '"priority_tier": 1,', indent: 1, key: 'priority_tier', valueType: 'number', type: 'highlighted' },
      { content: '"priority_label": "important",', indent: 1, key: 'priority_label', valueType: 'string', type: 'highlighted' },
      { content: '"age_escalated": true', indent: 1, key: 'age_escalated', valueType: 'boolean', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
];
