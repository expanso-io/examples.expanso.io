import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const splunkEdgeProcessingStages: Stage[] = [
  {
    id: 1,
    title: "Raw Syslog Data",
    description: "Unprocessed syslog messages from application servers. In traditional Splunk, ALL of this data gets indexed at $200/TB, including verbose DEBUG messages and noise.",
    yamlFilename: "splunk-input.yaml",
    yamlCode: `input:
  file:
    paths: [ "/var/log/app/*.log" ]
    multiline:
      pattern: '^\\d{4}-\\d{2}-\\d{2}'
      negate: true
      match: after`,
    inputLines: [
      { content: '2024-01-15 10:30:15 INFO  [main] Application started successfully', indent: 0 },
      { content: '2024-01-15 10:30:16 DEBUG [worker-1] Initializing connection pool', indent: 0 },
      { content: '2024-01-15 10:30:16 DEBUG [worker-1] Pool size: 10, timeout: 30s', indent: 0 },
      { content: '2024-01-15 10:30:17 WARN  [auth] Failed login attempt: user=admin ip=192.168.1.100', indent: 0 },
      { content: '2024-01-15 10:30:18 ERROR [db] Connection timeout to database server', indent: 0 },
      { content: '2024-01-15 10:30:19 DEBUG [health] Health check passed - all services OK', indent: 0 },
    ],
    outputLines: [
      { content: '2024-01-15 10:30:15 INFO  [main] Application started successfully', indent: 0 },
      { content: '2024-01-15 10:30:16 DEBUG [worker-1] Initializing connection pool', indent: 0 },
      { content: '2024-01-15 10:30:16 DEBUG [worker-1] Pool size: 10, timeout: 30s', indent: 0 },
      { content: '2024-01-15 10:30:17 WARN  [auth] Failed login attempt: user=admin ip=192.168.1.100', indent: 0 },
      { content: '2024-01-15 10:30:18 ERROR [db] Connection timeout to database server', indent: 0 },
      { content: '2024-01-15 10:30:19 DEBUG [health] Health check passed - all services OK', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Parse Fields (Like props.conf)",
    description: "Extract structured fields from log messages using Bloblang mapping. This replaces Splunk's props.conf and transforms.conf field extraction.",
    yamlFilename: "splunk-step-1-parse.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Parse syslog timestamp and message structure
        root.timestamp = this.match("^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})").string()
        root.level = this.match(" (INFO|WARN|ERROR|DEBUG) ").string()
        root.thread = this.match("\\[([^\\]]+)\\]").string()
        root.message = this.match("\\] (.+)$").string()
        root.raw = content()`,
    inputLines: [
      { content: '2024-01-15 10:30:15 INFO  [main] Application started successfully', indent: 0 },
      { content: '2024-01-15 10:30:16 DEBUG [worker-1] Initializing connection pool', indent: 0 },
      { content: '2024-01-15 10:30:17 WARN  [auth] Failed login attempt: user=admin ip=192.168.1.100', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15 10:30:15",', indent: 1, key: 'timestamp', valueType: 'string', type: 'added' },
      { content: '"level": "INFO",', indent: 1, key: 'level', valueType: 'string', type: 'added' },
      { content: '"thread": "main",', indent: 1, key: 'thread', valueType: 'string', type: 'added' },
      { content: '"message": "Application started successfully",', indent: 1, key: 'message', valueType: 'string', type: 'added' },
      { content: '"raw": "2024-01-15 10:30:15 INFO  [main] Application started successfully"', indent: 1, key: 'raw', valueType: 'string', type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Filter Out Noise (The Cost Saver)",
    description: "Drop DEBUG messages and verbose health checks before they reach Splunk. This is where you save 60-80% on indexing costs - traditional Splunk can't filter before indexing!",
    yamlFilename: "splunk-step-2-filter.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Drop DEBUG messages and health checks
        if this.level == "DEBUG" {
          root = deleted()
        }
        if this.message.contains("Health check passed") {
          root = deleted()
        }`,
    inputLines: [
      { content: '[6 messages total]', indent: 0, type: 'comment' },
      { content: '• INFO: Application started successfully', indent: 0 },
      { content: '• DEBUG: Initializing connection pool', indent: 0, type: 'removed' },
      { content: '• DEBUG: Pool size: 10, timeout: 30s', indent: 0, type: 'removed' },
      { content: '• WARN: Failed login attempt: user=admin ip=192.168.1.100', indent: 0 },
      { content: '• ERROR: Connection timeout to database server', indent: 0 },
      { content: '• DEBUG: Health check passed - all services OK', indent: 0, type: 'removed' },
    ],
    outputLines: [
      { content: '[3 messages remain - 50% reduction]', indent: 0, type: 'highlighted' },
      { content: '• INFO: Application started successfully', indent: 0 },
      { content: '• WARN: Failed login attempt: user=admin ip=192.168.1.100', indent: 0 },
      { content: '• ERROR: Connection timeout to database server', indent: 0 },
      { content: '', indent: 0 },
      { content: '💰 Cost Impact: $200/TB → $100/TB', indent: 0, type: 'highlighted' },
    ],
  },
  {
    id: 4,
    title: "Enrich for Splunk (sourcetype/index)",
    description: "Add Splunk-specific metadata including sourcetype, index, and host fields. This ensures proper routing and compliance within Splunk.",
    yamlFilename: "splunk-step-3-enrich.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root.event = {
          "timestamp": this.timestamp,
          "level": this.level,
          "thread": this.thread,
          "message": this.message,
          "raw": this.raw
        }
        # Add Splunk HEC metadata
        root.sourcetype = "app:custom"
        root.index = if this.level == "ERROR" { "security" } else { "main" }
        root.host = env("HOSTNAME").or("edge-node-01")
        root.source = "/var/log/app/application.log"`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15 10:30:17",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"level": "ERROR",', indent: 1, key: 'level', valueType: 'string' },
      { content: '"thread": "db",', indent: 1, key: 'thread', valueType: 'string' },
      { content: '"message": "Connection timeout to database server",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"raw": "2024-01-15 10:30:18 ERROR [db] Connection timeout..."', indent: 1, key: 'raw', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event": {', indent: 1, type: 'highlighted' },
      { content: '"timestamp": "2024-01-15 10:30:17",', indent: 2, key: 'timestamp', valueType: 'string' },
      { content: '"level": "ERROR",', indent: 2, key: 'level', valueType: 'string' },
      { content: '"thread": "db",', indent: 2, key: 'thread', valueType: 'string' },
      { content: '"message": "Connection timeout to database server",', indent: 2, key: 'message', valueType: 'string' },
      { content: '"raw": "2024-01-15 10:30:18 ERROR [db] Connection timeout..."', indent: 2, key: 'raw', valueType: 'string' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"sourcetype": "app:custom",', indent: 1, key: 'sourcetype', valueType: 'string', type: 'added' },
      { content: '"index": "security",', indent: 1, key: 'index', valueType: 'string', type: 'added' },
      { content: '"host": "edge-node-01",', indent: 1, key: 'host', valueType: 'string', type: 'added' },
      { content: '"source": "/var/log/app/application.log"', indent: 1, key: 'source', valueType: 'string', type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Ready for Splunk HEC",
    description: "Final JSON format optimized for Splunk HTTP Event Collector (HEC) ingestion with proper metadata organization and efficient batching.",
    yamlFilename: "splunk-output.yaml",
    yamlCode: `output:
  http:
    url: "https://splunk.company.com:8088/services/collector/event"
    verb: POST
    headers:
      Authorization: "Splunk \${SPLUNK_HEC_TOKEN}"
      Content-Type: "application/json"
    batching:
      count: 100
      period: 10s`,
    inputLines: [
      { content: '[Filtered messages: 70% reduction achieved]', indent: 0 },
    ],
    outputLines: [
      { content: '# HEC Endpoint: https://splunk.company.com:8088/services/collector/event', indent: 0, type: 'highlighted' },
      { content: '# Batching: 100 events or 10 seconds', indent: 0, type: 'highlighted' },
      { content: '# Index routing: security (errors), main (info/warn)', indent: 0, type: 'highlighted' },
      { content: '# Cost savings: 70% indexing reduction', indent: 0, type: 'highlighted' },
      { content: '# Compliance: PII-ready, structured fields', indent: 0, type: 'highlighted' },
    ],
  }
];