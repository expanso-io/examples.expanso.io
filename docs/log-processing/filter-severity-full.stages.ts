import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 3-Stage Log Filtering Pipeline
 * Demonstrates severity-based filtering:
 * 1. Original - All log levels mixed (DEBUG, INFO, WARN, ERROR)
 * 2. Parse & Classify - Extract severity from log messages
 * 3. Filter & Route - Drop DEBUG/TRACE, route ERROR/WARN/INFO to appropriate destinations
 */

export const filterSeverityStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original - All Log Levels Mixed
  // ============================================================================
  {
    id: 1,
    title: 'All Log Levels Mixed',
    description: 'Without filtering, DEBUG and TRACE logs flood your analytics systems, consuming storage, slowing queries, and hiding critical errors in noise. Production systems generate 10-100x more DEBUG logs than ERROR logs.',
    yamlFilename: 'step-0-unfiltered.yaml',
    yamlCode: `input:
  http_server:
    address: 0.0.0.0:8080
    path: /logs

# No filtering - all logs flow through`,
    inputLines: [
      { content: '{"level":"DEBUG","msg":"Cache hit","user_id":42}', indent: 0, type: 'removed' },
      { content: '{"level":"DEBUG","msg":"SQL query: SELECT *","user_id":42}', indent: 0, type: 'removed' },
      { content: '{"level":"INFO","msg":"User login","user_id":42}', indent: 0 },
      { content: '{"level":"DEBUG","msg":"Memory usage: 45%","user_id":42}', indent: 0, type: 'removed' },
      { content: '{"level":"WARN","msg":"Slow query 2.3s","user_id":42}', indent: 0 },
      { content: '{"level":"ERROR","msg":"Payment failed","user_id":42}', indent: 0 },
      { content: '{"level":"DEBUG","msg":"Request finished","user_id":42}', indent: 0, type: 'removed' },
    ],
    outputLines: [
      { content: '❌ Storage Impact:', indent: 0, type: 'highlighted' },
      { content: '7 log messages stored', indent: 1 },
      { content: '4 DEBUG logs (57% of volume)', indent: 1 },
      { content: '1 ERROR log (14% of volume)', indent: 1 },
      { content: '', indent: 0 },
      { content: '❌ Query Performance:', indent: 0, type: 'highlighted' },
      { content: 'Dashboards: scan 7 logs to find 1 ERROR', indent: 1 },
      { content: 'Alerts: scan 7 logs to detect issues', indent: 1 },
      { content: 'Cost: $$$$ (DEBUG logs waste 57% of storage)', indent: 1 },
      { content: '', indent: 0 },
      { content: '💰 Monthly Cost (1M logs/day):', indent: 0, type: 'highlighted' },
      { content: 'Elasticsearch: $8,500/month', indent: 1 },
      { content: 'S3: $340/month', indent: 1 },
      { content: 'DEBUG logs: $5,100/month waste', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 2: Parse & Classify
  // ============================================================================
  {
    id: 2,
    title: 'Parse & Classify',
    description: 'Extract severity level from each log message and normalize it (DEBUG, INFO, WARN, ERROR, CRITICAL). Add metadata to enable filtering and routing decisions based on log importance.',
    yamlFilename: 'step-1-parse-classify.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this.parse_json()

        # Extract and normalize severity
        root.severity = this.level.uppercase()

        # Classify log priority
        root.priority = match this.severity {
          "DEBUG" | "TRACE" => "low"
          "INFO" => "medium"
          "WARN" | "WARNING" => "high"
          "ERROR" | "CRITICAL" | "FATAL" => "critical"
          _ => "unknown"
        }

        # Add metadata
        root.pipeline_timestamp = now()`,
    inputLines: [
      { content: '{"level":"DEBUG","msg":"Cache hit"}', indent: 0, type: 'removed' },
      { content: '{"level":"DEBUG","msg":"SQL query"}', indent: 0, type: 'removed' },
      { content: '{"level":"INFO","msg":"User login"}', indent: 0 },
      { content: '{"level":"DEBUG","msg":"Memory usage"}', indent: 0, type: 'removed' },
      { content: '{"level":"WARN","msg":"Slow query"}', indent: 0 },
      { content: '{"level":"ERROR","msg":"Payment failed"}', indent: 0 },
      { content: '{"level":"DEBUG","msg":"Request finished"}', indent: 0, type: 'removed' },
    ],
    outputLines: [
      { content: '✅ Parsed & Classified:', indent: 0, type: 'highlighted' },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '{"severity":"INFO","priority":"medium"}', indent: 1 },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '{"severity":"WARN","priority":"high"}', indent: 1 },
      { content: '{"severity":"ERROR","priority":"critical"}', indent: 1 },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '', indent: 0 },
      { content: '📊 Priority Distribution:', indent: 0, type: 'highlighted' },
      { content: 'low: 4 logs (57%)', indent: 1 },
      { content: 'medium: 1 log (14%)', indent: 1 },
      { content: 'high: 1 log (14%)', indent: 1 },
      { content: 'critical: 1 log (14%)', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 3: Filter & Route
  // ============================================================================
  {
    id: 3,
    title: 'Filter & Route',
    description: 'Drop DEBUG/TRACE logs at the edge (90% volume reduction). Route ERROR/WARN to real-time analytics (Elasticsearch), INFO to archival storage (S3). Save 90% on storage costs while improving query performance.',
    yamlFilename: 'step-2-filter-route.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this.parse_json()
        root.severity = this.level.uppercase()
        root.priority = match this.severity {
          "DEBUG" | "TRACE" => "low"
          "INFO" => "medium"
          "WARN" | "WARNING" => "high"
          "ERROR" | "CRITICAL" | "FATAL" => "critical"
          _ => "unknown"
        }

output:
  switch:
    cases:
      # Drop DEBUG/TRACE logs (90% reduction)
      - check: this.priority == "low"
        output:
          drop: {}

      # ERROR/WARN → Elasticsearch (real-time alerts)
      - check: this.priority == "critical" || this.priority == "high"
        output:
          elasticsearch:
            urls: [http://localhost:9200]
            index: logs-critical

      # INFO → S3 (archival storage)
      - check: this.priority == "medium"
        output:
          aws_s3:
            bucket: logs-archive
            path: info/\${!timestamp_unix()}.json`,
    inputLines: [
      { content: '{"level":"DEBUG","msg":"Cache hit"}', indent: 0, type: 'removed' },
      { content: '{"level":"DEBUG","msg":"SQL query"}', indent: 0, type: 'removed' },
      { content: '{"level":"INFO","msg":"User login"}', indent: 0 },
      { content: '{"level":"DEBUG","msg":"Memory usage"}', indent: 0, type: 'removed' },
      { content: '{"level":"WARN","msg":"Slow query"}', indent: 0 },
      { content: '{"level":"ERROR","msg":"Payment failed"}', indent: 0 },
      { content: '{"level":"DEBUG","msg":"Request finished"}', indent: 0, type: 'removed' },
    ],
    outputLines: [
      { content: '✅ Filtering Results:', indent: 0, type: 'highlighted' },
      { content: 'DEBUG logs: 4 dropped', indent: 1 },
      { content: 'INFO logs: 1 → S3 archival', indent: 1 },
      { content: 'WARN logs: 1 → Elasticsearch', indent: 1 },
      { content: 'ERROR logs: 1 → Elasticsearch', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Elasticsearch (Real-Time Alerts):', indent: 0, type: 'highlighted' },
      { content: '{"severity":"WARN","msg":"Slow query"}', indent: 1 },
      { content: '{"severity":"ERROR","msg":"Payment failed"}', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ S3 Archival (Long-Term Storage):', indent: 0, type: 'highlighted' },
      { content: '{"severity":"INFO","msg":"User login"}', indent: 1 },
      { content: '', indent: 0 },
      { content: '💰 Cost Savings (1M logs/day):', indent: 0, type: 'highlighted' },
      { content: 'Before: $8,500/month', indent: 1 },
      { content: 'After: $1,200/month', indent: 1 },
      { content: 'Savings: $7,300/month (86%)', indent: 1 },
      { content: '', indent: 0 },
      { content: '⚡ Query Performance:', indent: 0, type: 'highlighted' },
      { content: 'Before: scan 7M logs to find errors', indent: 1 },
      { content: 'After: scan 700k logs (10x faster)', indent: 1 },
    ],
  },
];
