import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const productionPipelineStages: Stage[] = [
  {
    id: 1,
    title: 'Raw HTTP Input',
    description: 'Production systems receive raw unstructured logs via HTTP POST. No validation, no metadata, no structure - just raw text that needs comprehensive processing before analytics.',
    yamlFilename: 'step-0-raw-input.yaml',
    yamlCode: `input:
  http_server:
    address: 0.0.0.0:8080
    path: /logs`,
    inputLines: [
      { content: '{"msg":"User login","user":"john@example.com"}', indent: 0 },
    ],
    outputLines: [
      { content: '❌ Raw, Unstructured:', indent: 0, type: 'highlighted' },
      { content: 'No timestamp', indent: 1 },
      { content: 'No correlation ID', indent: 1 },
      { content: 'PII exposed (email)', indent: 1 },
      { content: 'No priority/severity', indent: 1 },
    ],
  },
  {
    id: 2,
    title: 'Parse & Validate',
    description: 'Parse JSON, validate schema with required fields (msg, user). Invalid logs route to DLQ for debugging. Add pipeline metadata showing when/where processing occurred.',
    yamlFilename: 'step-1-parse-validate.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this.parse_json()
        # Validate required fields
        root.msg = this.msg.or(throw("missing msg"))
        root.user = this.user.or(throw("missing user"))`,
    inputLines: [
      { content: '{"msg":"User login","user":"john@example.com"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Parsed & Validated:', indent: 0, type: 'highlighted' },
      { content: '{"msg":"User login",', indent: 1 },
      { content: '"user":"john@example.com"}', indent: 1 },
    ],
  },
  {
    id: 3,
    title: 'Enrich Metadata',
    description: 'Add timestamps (ingestion + processing), correlation ID for tracing, pipeline version. Essential metadata for debugging, SLA tracking, and distributed tracing.',
    yamlFilename: 'step-2-enrich-metadata.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        root.metadata.ingestion_time = now()
        root.metadata.correlation_id = uuid_v4()
        root.metadata.pipeline_version = "v2.1"
        root.metadata.edge_node = env("HOSTNAME")`,
    inputLines: [
      { content: '{"msg":"User login","user":"john@example.com"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Enriched:', indent: 0, type: 'highlighted' },
      { content: '{"msg":"User login",', indent: 1 },
      { content: '"user":"john@example.com",', indent: 1 },
      { content: '"metadata":{', indent: 1 },
      { content: '"ingestion_time":"2024-01-15T10:30:00Z",', indent: 2 },
      { content: '"correlation_id":"abc123",', indent: 2 },
      { content: '"pipeline_version":"v2.1"}}', indent: 2 },
    ],
  },
  {
    id: 4,
    title: 'Filter & Score',
    description: 'Drop DEBUG/TRACE logs (90% volume reduction). Assign priority scores (1-10) based on severity, user tier, message keywords. High-priority logs get fast-path routing to real-time alerts.',
    yamlFilename: 'step-3-filter-score.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        # Assign priority score
        root.priority = match {
          this.msg.contains("error") => 10
          this.msg.contains("warn") => 7
          this.msg.contains("login") => 5
          _ => 3
        }
    - bloblang: |
        # Drop low-priority logs
        root = if this.priority < 4 { deleted() }`,
    inputLines: [
      { content: '{"msg":"User login","user":"john@example.com"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Scored & Filtered:', indent: 0, type: 'highlighted' },
      { content: '{"msg":"User login",', indent: 1 },
      { content: '"priority":5}', indent: 1 },
      { content: '', indent: 0 },
      { content: '💾 Volume Reduction:', indent: 0, type: 'highlighted' },
      { content: 'DEBUG logs: dropped (90%)', indent: 1 },
      { content: 'Kept: priority ≥ 4', indent: 1 },
    ],
  },
  {
    id: 5,
    title: 'Redact PII',
    description: 'Remove sensitive data (emails, IPs, SSNs) using regex patterns and hashing. GDPR/CCPA compliant - only pseudonymized identifiers remain for analytics. Original PII never reaches cloud storage.',
    yamlFilename: 'step-4-redact-pii.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        # Hash email for privacy
        root.user_hash = this.user.hash("sha256").string()
        root = this.without("user")`,
    inputLines: [
      { content: '{"msg":"User login",', indent: 0 },
      { content: '"user":"john@example.com",', indent: 0, type: 'removed' },
      { content: '"priority":5}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ PII Redacted:', indent: 0, type: 'highlighted' },
      { content: '{"msg":"User login",', indent: 1 },
      { content: '"user_hash":"abc123def...",', indent: 1, type: 'highlighted' },
      { content: '"priority":5}', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ GDPR Compliant:', indent: 0, type: 'highlighted' },
      { content: 'Email: hashed (can\'t reverse)', indent: 1 },
      { content: 'Analytics: enabled with hash', indent: 1 },
      { content: 'Risk: eliminated', indent: 1 },
    ],
  },
  {
    id: 6,
    title: 'Fan-Out',
    description: 'Route to multiple destinations based on priority: ERROR/WARN → Elasticsearch (real-time alerts), INFO → Kafka (stream processing), ALL → S3 (long-term archival). 99.9% delivery guarantee with fallbacks.',
    yamlFilename: 'step-5-fan-out.yaml',
    yamlCode: `output:
  broker:
    pattern: fan_out
    outputs:
      # 1. Real-time alerts (high priority)
      - switch:
          - check: this.priority >= 7
            output:
              elasticsearch:
                urls: [http://localhost:9200]
                index: logs-critical

      # 2. Stream processing (all logs)
      - kafka:
          addresses: [localhost:9092]
          topic: logs-stream

      # 3. Long-term archival (S3)
      - aws_s3:
          bucket: logs-archive
          path: \${!timestamp_unix()}.json`,
    inputLines: [
      { content: '{"msg":"User login",', indent: 0 },
      { content: '"user_hash":"abc123",', indent: 0 },
      { content: '"priority":5}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Fan-Out Destinations:', indent: 0, type: 'highlighted' },
      { content: '1️⃣ Elasticsearch: skipped (priority < 7)', indent: 1 },
      { content: '2️⃣ Kafka: sent ✓', indent: 1, type: 'highlighted' },
      { content: '3️⃣ S3: sent ✓', indent: 1, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '⚡ Delivery:', indent: 0, type: 'highlighted' },
      { content: 'Kafka: real-time stream', indent: 1 },
      { content: 'S3: long-term archival', indent: 1 },
      { content: 'Elasticsearch: only high-priority', indent: 1 },
    ],
  },
];
