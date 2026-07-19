#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Deterministic source for small, synthetic fixtures that predate the
 * per-family generators. These bytes are configuration examples and fictional
 * records; they contain no customer or third-party data.
 */
const generated = new Map<string, string>([
  [
    'examples/data-routing/input.yaml',
    String.raw`# No priority routing - all messages treated equally
output:
  kafka:
    addresses: ["kafka-broker-1:9092","kafka-broker-2:9092"]
    topic: all-events
    batching:
      count: 100      # Same batching for all
      period: 30s     # Same delay for all
    max_retries: 3    # Same reliability for all
`,
  ],
  [
    'examples/data-security/input.json',
    String.raw`# No encryption yet - raw input
input:
  http_server:
    address: "0.0.0.0:8080"
    path: "/payments"
`,
  ],
  [
    'examples/data-security/output.json',
    String.raw`# Complete encrypted transaction
output:
  kafka:
    addresses: ["kafka:9092"]
    topic: encrypted-payments
`,
  ],
  [
    'examples/data-transformation/input.json',
    String.raw`# Original input - no deduplication yet
input:
  http_server:
    address: "0.0.0.0:8080"
    path: "/webhooks/events"
`,
  ],
  [
    'examples/data-transformation/input.jsonl',
    String.raw`# No processing - just input pass-through
input:
  file:
    paths: ["sensor-data.jsonl"]

pipeline:
  processors: []  # No transformation

output:
  stdout:
    codec: lines
`,
  ],
  [
    'examples/enterprise-migration/db2-to-bigquery/sample-input.json',
    String.raw`{
  "TRANSACTION_ID": "TXN-2024-00123456",
  "ACCOUNT_NUMBER": "4532-1234-5678-9012",
  "CUSTOMER_ID": "CUST-789012",
  "TRANSACTION_DATE": "2024-01-15",
  "TRANSACTION_TYPE": "PURCHASE",
  "AMOUNT": 125.50,
  "CURRENCY": "EUR",
  "MERCHANT_NAME": "ACME Electronics GmbH",
  "MERCHANT_CATEGORY_CODE": "5411",
  "SOURCE_SYSTEM": "CORE_BANKING_EU",
  "CREATED_AT": "2024-01-15T14:32:17Z"
}
`,
  ],
  [
    'examples/enterprise-migration/db2-to-bigquery/sample-output.json',
    String.raw`{
  "transaction_id": "TXN-2024-00123456",
  "customer_id": "CUST-789012",
  "transaction_date": "2024-01-15",
  "transaction_type": "PURCHASE",
  "merchant_name": "ACME Electronics GmbH",
  "merchant_category_code": "5411",
  "source_system": "CORE_BANKING_EU",
  "created_at": "2024-01-15T14:32:17Z",
  "amount_usd": 135.54,
  "original_amount": 125.50,
  "original_currency": "EUR",
  "account_number_masked": "****-****-9012",
  "account_number_hash": "a1b2c3d4e5f67890",
  "transaction_category": "GROCERY",
  "_partition_date": "2024-01-15",
  "_lineage": {
    "source_system": "DB2_PROD",
    "source_table": "TRANSACTIONS",
    "pipeline": "db2-to-bigquery-transactions",
    "extracted_at": "2024-01-16T02:00:00Z",
    "node_id": "edge-node-eu-west-1"
  }
}
`,
  ],
  [
    'examples/log-processing/input.yaml',
    String.raw`input:
  generate:
    interval: 2s
    mapping: |
      root.id = uuid_v4()
      root.timestamp = now()
      root.level = "INFO"
      root.service = "demo-service"
      root.message = "Demo log message from edge"
      root.user_id = "user_123"
      root.request_id = uuid_v4()
`,
  ],
  [
    'examples/log-processing/output.jsonl',
    String.raw`# S3 File: logs/demo_1705315800.jsonl
{"event":{"id":"...","timestamp":"...","level":"INFO",...},"metadata":{"node_id":"edge-node-01",...}}
{"event":{"id":"...","timestamp":"...","level":"ERROR",...},"metadata":{"node_id":"edge-node-01",...}}
{"event":{"id":"...","timestamp":"...","level":"WARN",...},"metadata":{"node_id":"edge-node-01",...}}
...
`,
  ],
  [
    'examples/integrations/oran-input.yaml',
    String.raw`input:
  prometheus_input:
    url: "http://localhost:9090/api/v1/query_range"
    query: "up{job=~'du-.*'}"
    interval: 30s
    endpoint_metadata: true
`,
  ],
  [
    'examples/integrations/splunk-input.yaml',
    String.raw`input:
  file:
    paths: [ "/var/log/app/*.log" ]
    multiline:
      pattern: '^\\d{4}-\\d{2}-\\d{2}'
      negate: true
      match: after
`,
  ],
]);

const write = process.argv.slice(2).includes('--write');
const drift: string[] = [];

for (const [path, bytes] of generated) {
  const absolutePath = resolve(path);
  if (write) {
    writeFileSync(absolutePath, bytes);
  } else if (readFileSync(absolutePath, 'utf8') !== bytes) {
    drift.push(path);
  }
}

if (drift.length > 0) {
  throw new Error(`Foundation fixture drift: ${drift.join(', ')}`);
}

process.stdout.write(
  write
    ? `Wrote ${generated.size} deterministic foundation fixtures.\n`
    : `Foundation fixtures are deterministic (${generated.size} files).\n`
);
