# Example pipeline validation: 2026-10-06

Overall: **FAIL**

- expanso-edge: `v2.1.22` (pinned: `v2.1.22`)
- Inventory digest: `sha256:01576c6768cd19c7683adb2e4714c37aee40cb4dcbf00f60002c8167dae07016`
- Complete pipelines: 106. Validate: 106 pass, 0 fail. Run: 96 pass, 10 fail, 0 skipped.
- Fragments (partial snippets, validated inside a synthetic pipeline, never run): 168. 101 pass, 67 fail.

How to read this report:

- **Validate** runs `expanso-edge validate` on the file as committed. Fragments are wrapped in a generate-to-drop pipeline first.
- Validation-only environment values in the fixture manifest satisfy non-metered local salts where the validator requires a concrete string.
- **Run** deploys the pipeline to a local-mode expanso-edge agent and requires the expected output to be written. `native` means the file ran as written. `fixture harness` means the input was replaced by a checked-in fixture file and every leaf output by a local file; processor and resource substitutions are listed below. Runs with those substitutions exercise stubbed processing and do not verify the replaced integrations.
- **SKIP** names the external service or missing fixture that prevents a local run. Skipped pipelines are still validated.
- Regenerate locally with `npm run validate-examples`.

## Complete pipelines

### data-routing

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| circuit-breakers | [examples/data-routing/circuit-breakers-complete.yaml](../../examples/data-routing/circuit-breakers-complete.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| circuit-breakers | [examples/data-routing/circuit-breakers-foundation.yaml](../../examples/data-routing/circuit-breakers-foundation.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| content-routing | [examples/data-routing/complete-content-routing.yaml](../../examples/data-routing/complete-content-routing.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out | [examples/data-routing/complete-fan-out.yaml](../../examples/data-routing/complete-fan-out.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-routing | [examples/data-routing/content-routing.yaml](../../examples/data-routing/content-routing.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-splitting | [examples/data-routing/content-splitting-complete.yaml](../../examples/data-routing/content-splitting-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-splitting | [examples/data-routing/content-splitting-foundation.yaml](../../examples/data-routing/content-splitting-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-splitting | [examples/data-routing/content-splitting.yaml](../../examples/data-routing/content-splitting.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| database-circuit-breaker | [examples/data-routing/database-circuit-breaker-foundation.yaml](../../examples/data-routing/database-circuit-breaker-foundation.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| fan-out | [examples/data-routing/fan-out-complete.yaml](../../examples/data-routing/fan-out-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out | [examples/data-routing/fan-out-foundation.yaml](../../examples/data-routing/fan-out-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-kafka | [examples/data-routing/fan-out-kafka.yaml](../../examples/data-routing/fan-out-kafka.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/data-routing/fan-out-pattern-complete.yaml](../../examples/data-routing/fan-out-pattern-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/data-routing/fan-out-pattern.yaml](../../examples/data-routing/fan-out-pattern.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-s3 | [examples/data-routing/fan-out-s3.yaml](../../examples/data-routing/fan-out-s3.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| kafka-fan-out | [examples/data-routing/kafka-fan-out.yaml](../../examples/data-routing/kafka-fan-out.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| order-processing | [examples/data-routing/order-processing-foundation.yaml](../../examples/data-routing/order-processing-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| priority-queues | [examples/data-routing/priority-queues-complete.yaml](../../examples/data-routing/priority-queues-complete.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| priority-queues | [examples/data-routing/priority-queues-foundation.yaml](../../examples/data-routing/priority-queues-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| priority-queues | [examples/data-routing/priority-queues.yaml](../../examples/data-routing/priority-queues.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| s3-fan-out | [examples/data-routing/s3-fan-out.yaml](../../examples/data-routing/s3-fan-out.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| single-destination | [examples/data-routing/single-destination.yaml](../../examples/data-routing/single-destination.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| smart-buffering | [examples/data-routing/smart-buffering-foundation.yaml](../../examples/data-routing/smart-buffering-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| smart-buffering | [examples/data-routing/smart-buffering-step-1.yaml](../../examples/data-routing/smart-buffering-step-1.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| smart-buffering | [examples/data-routing/smart-buffering-step-2.yaml](../../examples/data-routing/smart-buffering-step-2.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| smart-buffering | [examples/data-routing/smart-buffering-step-3.yaml](../../examples/data-routing/smart-buffering-step-3.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| smart-buffering | [examples/data-routing/smart-buffering-step-4.yaml](../../examples/data-routing/smart-buffering-step-4.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| smart-buffering | [examples/data-routing/smart-buffering.yaml](../../examples/data-routing/smart-buffering.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| step-0-original | [examples/data-routing/step-0-original.yaml](../../examples/data-routing/step-0-original.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-routing | [static/files/data-routing/content-routing.yaml](../../static/files/data-routing/content-routing.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-splitting | [static/files/data-routing/content-splitting.yaml](../../static/files/data-routing/content-splitting.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| priority-queues | [static/files/data-routing/priority-queues.yaml](../../static/files/data-routing/priority-queues.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| smart-buffering | [static/files/data-routing/smart-buffering.yaml](../../static/files/data-routing/smart-buffering.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### data-security

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| cross-border-gdpr | [examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml](../../examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| encrypt-data | [examples/data-security/encrypt-data-complete.yaml](../../examples/data-security/encrypt-data-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| encrypt-data | [examples/data-security/encrypt-data.yaml](../../examples/data-security/encrypt-data.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| encryption | [examples/data-security/encryption-foundation.yaml](../../examples/data-security/encryption-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| encryption-patterns | [examples/data-security/encryption-patterns-complete.yaml](../../examples/data-security/encryption-patterns-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| enforce-schema | [examples/data-security/enforce-schema-complete.yaml](../../examples/data-security/enforce-schema-complete.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| enforce-schema | [examples/data-security/enforce-schema.yaml](../../examples/data-security/enforce-schema.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| remove-pii | [examples/data-security/remove-pii-complete.yaml](../../examples/data-security/remove-pii-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| remove-pii | [examples/data-security/remove-pii-foundation.yaml](../../examples/data-security/remove-pii-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| remove-pii | [examples/data-security/remove-pii.yaml](../../examples/data-security/remove-pii.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| schema-validation | [examples/data-security/schema-validation-foundation.yaml](../../examples/data-security/schema-validation-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| cross-border-gdpr | [static/files/data-security/cross-border-gdpr.yaml](../../static/files/data-security/cross-border-gdpr.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| encrypt-data | [static/files/data-security/encrypt-data.yaml](../../static/files/data-security/encrypt-data.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| enforce-schema | [static/files/data-security/enforce-schema.yaml](../../static/files/data-security/enforce-schema.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |

### data-transformation

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| aggregate-time-windows | [examples/data-transformation/aggregate-time-windows-complete.yaml](../../examples/data-transformation/aggregate-time-windows-complete.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| aggregate-time-windows | [examples/data-transformation/aggregate-time-windows.yaml](../../examples/data-transformation/aggregate-time-windows.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| deduplicate-events | [examples/data-transformation/deduplicate-events-complete.yaml](../../examples/data-transformation/deduplicate-events-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| deduplicate-events | [examples/data-transformation/deduplicate-events.yaml](../../examples/data-transformation/deduplicate-events.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| deduplication | [examples/data-transformation/deduplication-foundation.yaml](../../examples/data-transformation/deduplication-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| format-transform | [examples/data-transformation/format-transform-foundation.yaml](../../examples/data-transformation/format-transform-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| log-parsing | [examples/data-transformation/log-parsing-foundation.yaml](../../examples/data-transformation/log-parsing-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| normalization | [examples/data-transformation/normalization-foundation.yaml](../../examples/data-transformation/normalization-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| normalize-timestamps | [examples/data-transformation/normalize-timestamps-complete.yaml](../../examples/data-transformation/normalize-timestamps-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| normalize-timestamps | [examples/data-transformation/normalize-timestamps.yaml](../../examples/data-transformation/normalize-timestamps.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| parse-logs | [examples/data-transformation/parse-logs-complete.yaml](../../examples/data-transformation/parse-logs-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| parse-logs | [examples/data-transformation/parse-logs.yaml](../../examples/data-transformation/parse-logs.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| step-4-production | [examples/data-transformation/step-4-production.yaml](../../examples/data-transformation/step-4-production.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| transform-formats | [examples/data-transformation/transform-formats-complete.yaml](../../examples/data-transformation/transform-formats-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| transform-formats | [examples/data-transformation/transform-formats.yaml](../../examples/data-transformation/transform-formats.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| tumbling-windows | [examples/data-transformation/tumbling-windows-foundation.yaml](../../examples/data-transformation/tumbling-windows-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| aggregate-time-windows | [static/files/data-transformation/aggregate-time-windows.yaml](../../static/files/data-transformation/aggregate-time-windows.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| deduplicate-events | [static/files/data-transformation/deduplicate-events.yaml](../../static/files/data-transformation/deduplicate-events.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| normalize-timestamps | [static/files/data-transformation/normalize-timestamps.yaml](../../static/files/data-transformation/normalize-timestamps.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| parse-logs | [static/files/data-transformation/parse-logs.yaml](../../static/files/data-transformation/parse-logs.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| transform-formats | [static/files/data-transformation/transform-formats.yaml](../../static/files/data-transformation/transform-formats.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### enterprise-migration

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| db2-to-bigquery | [examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml](../../examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| nightly-backup | [examples/enterprise-migration/nightly-backup/nightly-backup.yaml](../../examples/enterprise-migration/nightly-backup/nightly-backup.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| db2-to-bigquery | [static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml](../../static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| nightly-backup | [static/files/enterprise-migration/nightly-backup/nightly-backup.yaml](../../static/files/enterprise-migration/nightly-backup/nightly-backup.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### explorer-stages

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| aggregate-time-windows | [examples/explorer-stages/aggregate-time-windows/01-original-high-frequency-events.yaml](../../examples/explorer-stages/aggregate-time-windows/01-original-high-frequency-events.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| aggregate-time-windows | [examples/explorer-stages/aggregate-time-windows/05-multi-level-configuration.yaml](../../examples/explorer-stages/aggregate-time-windows/05-multi-level-configuration.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| content-routing | [examples/explorer-stages/content-routing/01-original-input.yaml](../../examples/explorer-stages/content-routing/01-original-input.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| content-splitting | [examples/explorer-stages/content-splitting/01-original-bundled-message.yaml](../../examples/explorer-stages/content-splitting/01-original-bundled-message.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| encryption-patterns | [examples/explorer-stages/encryption-patterns/01-original-sensitive-data.yaml](../../examples/explorer-stages/encryption-patterns/01-original-sensitive-data.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/explorer-stages/fan-out-pattern/01-single-destination.yaml](../../examples/explorer-stages/fan-out-pattern/01-single-destination.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/explorer-stages/fan-out-pattern/02-broker-fan-out-foundation.yaml](../../examples/explorer-stages/fan-out-pattern/02-broker-fan-out-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/explorer-stages/fan-out-pattern/03-kafka-real-time-streaming.yaml](../../examples/explorer-stages/fan-out-pattern/03-kafka-real-time-streaming.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/explorer-stages/fan-out-pattern/04-s3-long-term-archive.yaml](../../examples/explorer-stages/fan-out-pattern/04-s3-long-term-archive.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| fan-out-pattern | [examples/explorer-stages/fan-out-pattern/05-elasticsearch-search-analytics.yaml](../../examples/explorer-stages/fan-out-pattern/05-elasticsearch-search-analytics.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### first-results

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| filter-logs | [static/files/first-results/filter-logs.yaml](../../static/files/first-results/filter-logs.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| process-locally | [static/files/first-results/process-locally.yaml](../../static/files/first-results/process-locally.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| remove-pii | [static/files/first-results/remove-pii.yaml](../../static/files/first-results/remove-pii.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### getting-started

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| quickstart | [examples/getting-started/quickstart-complete.yaml](../../examples/getting-started/quickstart-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### integrations

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| medical-device-intelligence | [docs/integrations/medical-device-intelligence/pipeline.yaml](../../docs/integrations/medical-device-intelligence/pipeline.yaml) | PASS | PASS (stubbed fixture harness) | v2.1.22 |
| scada-energy-edge | [examples/integrations/scada-energy-edge/scada-edge-complete.yaml](../../examples/integrations/scada-energy-edge/scada-edge-complete.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| step-1-parse-registers | [examples/integrations/scada-energy-edge/step-1-parse-registers.yaml](../../examples/integrations/scada-energy-edge/step-1-parse-registers.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| step-2-filter-nominal | [examples/integrations/scada-energy-edge/step-2-filter-nominal.yaml](../../examples/integrations/scada-energy-edge/step-2-filter-nominal.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| step-3-classify-faults | [examples/integrations/scada-energy-edge/step-3-classify-faults.yaml](../../examples/integrations/scada-energy-edge/step-3-classify-faults.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| step-4-route-destinations | [examples/integrations/scada-energy-edge/step-4-route-destinations.yaml](../../examples/integrations/scada-energy-edge/step-4-route-destinations.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| motherduck-retail-analytics | [static/pipelines/motherduck-retail-pipeline.yaml](../../static/pipelines/motherduck-retail-pipeline.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| oran-telco-pipeline | [static/pipelines/oran-telco-pipeline.yaml](../../static/pipelines/oran-telco-pipeline.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| splunk-edge-processing | [static/pipelines/splunk-production-pipeline.yaml](../../static/pipelines/splunk-production-pipeline.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

### log-processing

| Pipeline | Source | Validate | Run | expanso-edge |
|---|---|---|---|---|
| enrich-export | [examples/log-processing/enrich-export-complete.yaml](../../examples/log-processing/enrich-export-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| enrich-export | [examples/log-processing/enrich-export.yaml](../../examples/log-processing/enrich-export.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| enrichment | [examples/log-processing/enrichment-foundation.yaml](../../examples/log-processing/enrichment-foundation.yaml) | PASS | FAIL: semantic output verification failed | v2.1.22 |
| filter-severity | [examples/log-processing/filter-severity-complete.yaml](../../examples/log-processing/filter-severity-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| filter-severity | [examples/log-processing/filter-severity.yaml](../../examples/log-processing/filter-severity.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| filtering | [examples/log-processing/filtering-foundation.yaml](../../examples/log-processing/filtering-foundation.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| production-pipeline | [examples/log-processing/production-pipeline-complete.yaml](../../examples/log-processing/production-pipeline-complete.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| production-pipeline | [examples/log-processing/production-pipeline.yaml](../../examples/log-processing/production-pipeline.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| enrich-export | [static/files/log-processing/enrich-export.yaml](../../static/files/log-processing/enrich-export.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| filter-severity | [static/files/log-processing/filter-severity.yaml](../../static/files/log-processing/filter-severity.yaml) | PASS | PASS (fixture harness) | v2.1.22 |
| production-pipeline | [static/files/log-processing/production-pipeline.yaml](../../static/files/log-processing/production-pipeline.yaml) | PASS | PASS (fixture harness) | v2.1.22 |

## Failure details

### examples/data-routing/circuit-breakers-foundation.yaml

Run failure: semantic output verification failed

```text
missing expected record at output undefined
```

### examples/data-routing/priority-queues-complete.yaml

Run failure: semantic output verification failed

```text
record count at output 0

0 !== 1
```

### examples/data-routing/smart-buffering-step-1.yaml

Run failure: semantic output verification failed

```text
unexpected priority_tier: 2
```

### examples/data-routing/smart-buffering-step-3.yaml

Run failure: semantic output verification failed

```text
unexpected priority_score: 500
```

### examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml

Run failure: semantic output verification failed

```text
unexpected amount_usd: 135.54000000000002
```

### examples/integrations/scada-energy-edge/scada-edge-complete.yaml

Run failure: semantic output verification failed

```text
missing expected record at output undefined
```

### examples/integrations/scada-energy-edge/step-3-classify-faults.yaml

Run failure: semantic output verification failed

```text
missing expected record at output undefined
```

### examples/integrations/scada-energy-edge/step-4-route-destinations.yaml

Run failure: semantic output verification failed

```text
missing expected record at output undefined
```

### examples/log-processing/enrichment-foundation.yaml

Run failure: semantic output verification failed

```text
missing id
```

### static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml

Run failure: semantic output verification failed

```text
unexpected amount_usd: 135.54000000000002
```

## Run substitutions

Input, output, processor, and resource substitutions made by the fixture harness. Replaced processors and resources were not exercised as committed.

<details><summary>Show per-pipeline substitutions</summary>

- `docs/integrations/medical-device-intelligence/pipeline.yaml` (fixture: `tests/fixtures/pipeline-inputs/medical-device-intelligence.jsonl`)
  - processor `pipeline.processors.1`: command to deterministic mapping stub
  - input `input`: broker to file (tests/fixtures/pipeline-inputs/medical-device-intelligence.jsonl)
  - output `output.broker.outputs.0.file.path`: ./output/review-candidates.json to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1`: http_client to file (.validation-output/02-http_client.jsonl)
- `examples/data-routing/circuit-breakers-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - processor `pipeline.processors.1.branch.processors.0.try.0`: http to deterministic mapping stub
  - processor `pipeline.processors.1.branch.processors.1.catch.1.try.0`: http to deterministic mapping stub
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.fallback.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.fallback.1`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.fallback.2.file.path`: /var/expanso/buffer/${!timestamp_unix_date('2006-01-02')}/events.jsonl to .validation-output/03-file.jsonl
  - output `output.fallback.3.file.path`: /var/expanso/dlq/${!timestamp_unix_date('2006-01-02')}/failed.jsonl to .validation-output/04-file.jsonl
- `examples/data-routing/circuit-breakers-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - processor `pipeline.processors.0`: http to deterministic mapping stub
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-routing/complete-content-routing.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.switch.cases.0.output.broker.outputs.1`: http_client to file (.validation-output/02-http_client.jsonl)
  - output `output.switch.cases.1.output`: kafka to file (.validation-output/03-kafka.jsonl)
  - output `output.switch.cases.2.output`: kafka to file (.validation-output/04-kafka.jsonl)
  - output `output.switch.cases.3.output.file.path`: /var/expanso/telemetry/${!timestamp_unix_date('2006-01-02')}.jsonl to .validation-output/05-file.jsonl
  - output `output.switch.cases.4.output`: kafka to file (.validation-output/06-kafka.jsonl)
- `examples/data-routing/complete-fan-out.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
  - output `output.broker.outputs.2`: opensearch to file (.validation-output/03-opensearch.jsonl)
- `examples/data-routing/content-routing.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output`: http_client to file (.validation-output/02-http_client.jsonl)
  - output `output.switch.cases.2.output`: opensearch to file (.validation-output/03-opensearch.jsonl)
- `examples/data-routing/content-splitting-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.switch.cases.1.output.file.path`: /var/expanso/dlq/${!timestamp_unix_date('2006-01-02')}/invalid-items.jsonl to .validation-output/02-file.jsonl
- `examples/data-routing/content-splitting-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-routing/content-splitting.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.switch.cases.2.output.file.path`: /var/expanso/sensor-data/normal-${!timestamp_unix_date("2006-01-02")}.jsonl to .validation-output/03-file.jsonl
- `examples/data-routing/database-circuit-breaker-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - processor `pipeline.processors.0.branch.processors.0`: sql_raw to deterministic mapping stub
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-routing/fan-out-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /tmp/events.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.broker.outputs.2`: aws_s3 to file (.validation-output/03-aws_s3.jsonl)
  - output `output.broker.outputs.3`: opensearch to file (.validation-output/04-opensearch.jsonl)
- `examples/data-routing/fan-out-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /var/data/realtime.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1.file.path`: /var/data/archive.jsonl to .validation-output/02-file.jsonl
- `examples/data-routing/fan-out-kafka.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /tmp/events.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1`: kafka to file (.validation-output/02-kafka.jsonl)
- `examples/data-routing/fan-out-pattern-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /tmp/events.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1.fallback.0`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.broker.outputs.1.fallback.1.file.path`: /tmp/kafka-fallback.jsonl to .validation-output/03-file.jsonl
  - output `output.broker.outputs.2.fallback.0`: aws_s3 to file (.validation-output/04-aws_s3.jsonl)
  - output `output.broker.outputs.2.fallback.1.file.path`: /tmp/s3-fallback.jsonl to .validation-output/05-file.jsonl
  - output `output.broker.outputs.3.fallback.0`: opensearch to file (.validation-output/06-opensearch.jsonl)
  - output `output.broker.outputs.3.fallback.1.file.path`: /tmp/es-fallback.jsonl to .validation-output/07-file.jsonl
- `examples/data-routing/fan-out-pattern.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /tmp/events.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.broker.outputs.2`: aws_s3 to file (.validation-output/03-aws_s3.jsonl)
  - output `output.broker.outputs.3`: opensearch to file (.validation-output/04-opensearch.jsonl)
- `examples/data-routing/fan-out-s3.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /tmp/events.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.broker.outputs.2`: aws_s3 to file (.validation-output/03-aws_s3.jsonl)
- `examples/data-routing/kafka-fan-out.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1.file.path`: /var/data/archive.jsonl to .validation-output/02-file.jsonl
- `examples/data-routing/order-processing-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-routing/priority-queues-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.switch.cases.1.output`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.switch.cases.2.output`: kafka to file (.validation-output/03-kafka.jsonl)
  - output `output.switch.cases.3.output`: kafka to file (.validation-output/04-kafka.jsonl)
- `examples/data-routing/priority-queues-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
- `examples/data-routing/priority-queues.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.switch.cases.1.output`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.switch.cases.2.output`: kafka to file (.validation-output/03-kafka.jsonl)
  - output `output.switch.cases.3.output`: kafka to file (.validation-output/04-kafka.jsonl)
  - output `output.switch.cases.4.output`: kafka to file (.validation-output/05-kafka.jsonl)
- `examples/data-routing/s3-fan-out.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
- `examples/data-routing/single-destination.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.file.path`: /var/data/events.jsonl to .validation-output/01-file.jsonl
- `examples/data-routing/smart-buffering-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `examples/data-routing/smart-buffering-step-1.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-routing/smart-buffering-step-2.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-routing/smart-buffering-step-3.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
- `examples/data-routing/smart-buffering-step-4.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
- `examples/data-routing/smart-buffering.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output`: http_client to file (.validation-output/02-http_client.jsonl)
  - output `output.switch.cases.2.output`: http_client to file (.validation-output/03-http_client.jsonl)
  - output `output.switch.cases.3.output`: http_client to file (.validation-output/04-http_client.jsonl)
- `examples/data-routing/step-0-original.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
- `examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml` (fixture: `tests/fixtures/pipeline-inputs/cross-border-gdpr.jsonl`)
  - input `input`: sql_select to file (tests/fixtures/pipeline-inputs/cross-border-gdpr.jsonl)
  - output `output.broker.outputs.0`: gcp_bigquery to file (.validation-output/01-gcp_bigquery.jsonl)
  - output `output.broker.outputs.1`: gcp_cloud_storage to file (.validation-output/02-gcp_cloud_storage.jsonl)
  - output `output.broker.outputs.2.file.path`: /var/log/expanso/gdpr-audit-${!timestamp_format("2006-01-02")}.jsonl to .validation-output/03-file.jsonl
- `examples/data-security/encrypt-data-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/encryption.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/encryption.jsonl)
  - input `input.processors`: request metadata to registered fixture request metadata
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-security/encrypt-data.yaml` (fixture: `tests/fixtures/pipeline-inputs/encryption.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/encryption.jsonl)
  - input `input.processors`: request metadata to registered fixture request metadata
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1`: http_client to file (.validation-output/02-http_client.jsonl)
- `examples/data-security/encryption-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-security.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-security.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-security/encryption-patterns-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/encryption.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/encryption.jsonl)
  - output `output.broker.outputs.0.file.path`: ./encrypted-data-${!timestamp_unix()}.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1.file.path`: ./audit-trail-${!timestamp_unix()}.jsonl to .validation-output/02-file.jsonl
- `examples/data-security/enforce-schema-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/sensor-schema-input.jsonl`)
  - resource `config.pipeline.processors.3.switch.0.processors.0.try.0.json_schema.schema_path`: file:///etc/expanso/schemas/sensor-schema.json to tests/fixtures/pipeline-inputs/sensor-schema.json
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/sensor-schema-input.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output.file.path`: /var/log/expanso/dlq/${!timestamp_unix_date('2006-01-02')}/failures.jsonl to .validation-output/02-file.jsonl
- `examples/data-security/enforce-schema.yaml` (fixture: `tests/fixtures/pipeline-inputs/sensor-schema-input.jsonl`)
  - resource `config.pipeline.processors.2.try.0.json_schema.schema_path`: file:///etc/expanso/schemas/sensor-schema-v1.0.0.json to tests/fixtures/pipeline-inputs/sensor-schema.json
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/sensor-schema-input.jsonl)
  - output `output.broker.outputs.0.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1.switch.cases.0.output.file.path`: /var/log/expanso/schema-validation-dlq-${!timestamp_unix()}.jsonl to .validation-output/02-file.jsonl
  - output `output.broker.outputs.2`: http_client to file (.validation-output/03-http_client.jsonl)
- `examples/data-security/remove-pii-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/remove-pii.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/remove-pii.jsonl)
  - output `output.file.path`: /var/log/expanso/pii-removed.jsonl to .validation-output/01-file.jsonl
- `examples/data-security/remove-pii-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/remove-pii.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/remove-pii.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-security/remove-pii.yaml` (fixture: `tests/fixtures/pipeline-inputs/remove-pii.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/remove-pii.jsonl)
  - output `output.switch.cases.0.output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.0.output.broker.outputs.1.file.path`: /var/log/expanso/pii-audit-${!timestamp_unix()}.jsonl to .validation-output/02-file.jsonl
  - output `output.switch.cases.1.output.file.path`: /var/log/expanso/pii-dlq-${!timestamp_unix()}.jsonl to .validation-output/03-file.jsonl
- `examples/data-security/schema-validation-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-security.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-security.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-transformation/aggregate-time-windows-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl`)
  - input `input`: kafka to file (tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl)
  - processor `pipeline.processors`: 60-second window arithmetic to 0.3-second window arithmetic for fixture execution
  - input `input.sequence`: fixture EOF after first window acknowledgement to finite input held open until overlapping windows flush
  - input `input.processors`: historical event timestamps to current timestamps at 1/200 time scale
  - resource `buffer.system_window`: one-minute window unit to 300ms window unit for fixture execution
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1.file.path`: /var/expanso/buffer/aggregations-${!timestamp_unix()}.jsonl to .validation-output/02-file.jsonl
- `examples/data-transformation/aggregate-time-windows.yaml` (fixture: `tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl)
  - processor `pipeline.processors`: 60-second window arithmetic to 0.3-second window arithmetic for fixture execution
  - input `input.processors`: historical event timestamps to current timestamps at 1/200 time scale
  - resource `buffer.system_window`: one-minute window unit to 300ms window unit for fixture execution
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `examples/data-transformation/deduplicate-events-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
- `examples/data-transformation/deduplicate-events.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `examples/data-transformation/deduplication-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-transformation/format-transform-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-transformation/log-parsing-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-transformation/normalization-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/data-transformation/normalize-timestamps-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: kafka to file (.validation-input/recent-timestamps.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
  - input `input.file`: historical normalization fixture timestamps to previous-day timestamps and matching semantic expectations
- `examples/data-transformation/normalize-timestamps.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (.validation-input/recent-timestamps.jsonl)
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.broker.outputs.2.switch.cases.0.output.file.path`: /var/log/expanso/timestamp-dlq.jsonl to .validation-output/03-file.jsonl
  - input `input.file`: historical normalization fixture timestamps to previous-day timestamps and matching semantic expectations
- `examples/data-transformation/parse-logs-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/parse-logs.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/parse-logs.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output.file.path`: /var/log/expanso/dlq/${!timestamp_unix_date('2006-01-02')}/unparsed.jsonl to .validation-output/02-file.jsonl
- `examples/data-transformation/parse-logs.yaml` (fixture: `tests/fixtures/pipeline-inputs/parse-logs.jsonl`)
  - input `input.file.paths`: ["/var/log/app/*.jsonl"] to tests/fixtures/pipeline-inputs/parse-logs.jsonl
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `examples/data-transformation/step-4-production.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: kafka to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - processor `pipeline.processors`: 60-second window arithmetic to 0.3-second window arithmetic for fixture execution
  - input `input.processors`: historical event timestamps to current timestamps at 1/200 time scale
  - resource `buffer.system_window`: one-minute window unit to 300ms window unit for fixture execution
  - output `output.fallback.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.fallback.1.file.path`: /var/buffer/aggregations.jsonl to .validation-output/02-file.jsonl
- `examples/data-transformation/transform-formats-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: sync_response to file (.validation-output/01-sync_response.jsonl)
- `examples/data-transformation/transform-formats.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output`: avro bytes to base64 framed file
- `examples/data-transformation/tumbling-windows-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml` (fixture: `tests/fixtures/pipeline-inputs/enterprise-migration.jsonl`)
  - input `input`: sql_select to file (tests/fixtures/pipeline-inputs/enterprise-migration.jsonl)
  - output `output`: gcp_bigquery to file (.validation-output/01-gcp_bigquery.jsonl)
- `examples/enterprise-migration/nightly-backup/nightly-backup.yaml` (fixture: `tests/fixtures/pipeline-inputs/nightly-backup.jsonl`)
  - input `input`: sequence to file (tests/fixtures/pipeline-inputs/nightly-backup.jsonl)
  - output `output.switch.cases.0.output`: gcp_cloud_storage to file (.validation-output/01-gcp_cloud_storage.jsonl)
  - output `output.switch.cases.0.output`: parquet bytes to file after Parquet decoding
  - output `output.switch.cases.0.output.gcp_cloud_storage.batching`: count=10000, period=60s to count=25, period=1s; batching processors retained
  - output `output.switch.cases.1.output`: gcp_cloud_storage to file (.validation-output/02-gcp_cloud_storage.jsonl)
  - output `output.switch.cases.1.output`: parquet bytes to file after Parquet decoding
  - output `output.switch.cases.1.output.gcp_cloud_storage.batching`: count=50000, period=120s to count=25, period=1s; batching processors retained
  - output `output.switch.cases.2.output`: gcp_cloud_storage to file (.validation-output/03-gcp_cloud_storage.jsonl)
  - output `output.switch.cases.2.output`: parquet bytes to file after Parquet decoding
  - output `output.switch.cases.2.output.gcp_cloud_storage.batching`: count=10000, period=60s to count=25, period=1s; batching processors retained
  - output `output.switch.cases.3.output`: gcp_cloud_storage to file (.validation-output/04-gcp_cloud_storage.jsonl)
- `examples/explorer-stages/aggregate-time-windows/01-original-high-frequency-events.yaml` (fixture: `tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl`)
  - input `input.file.paths`: ["sensor-data.jsonl"] to tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/explorer-stages/aggregate-time-windows/05-multi-level-configuration.yaml` (fixture: `tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl`)
  - input `input`: kafka to file (tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl)
  - processor `pipeline.processors`: 60-second window arithmetic to 0.3-second window arithmetic for fixture execution
  - input `input.processors`: historical event timestamps to current timestamps at 1/200 time scale
  - resource `buffer.system_window`: one-minute window unit to 300ms window unit for fixture execution
  - output `output.fallback.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.fallback.1.file.path`: /var/buffer/aggregations.jsonl to .validation-output/02-file.jsonl
- `examples/explorer-stages/content-routing/01-original-input.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
- `examples/explorer-stages/content-splitting/01-original-bundled-message.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.file.path`: /var/log/raw-input.jsonl to .validation-output/01-file.jsonl
- `examples/explorer-stages/encryption-patterns/01-original-sensitive-data.yaml` (fixture: `tests/fixtures/pipeline-inputs/encryption.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/encryption.jsonl)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/explorer-stages/fan-out-pattern/01-single-destination.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.file.path`: /var/data/events.jsonl to .validation-output/01-file.jsonl
- `examples/explorer-stages/fan-out-pattern/02-broker-fan-out-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0.file.path`: /var/data/realtime.jsonl to .validation-output/01-file.jsonl
  - output `output.broker.outputs.1.file.path`: /var/data/archive.jsonl to .validation-output/02-file.jsonl
- `examples/explorer-stages/fan-out-pattern/03-kafka-real-time-streaming.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1.file.path`: /var/data/archive.jsonl to .validation-output/02-file.jsonl
- `examples/explorer-stages/fan-out-pattern/04-s3-long-term-archive.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
- `examples/explorer-stages/fan-out-pattern/05-elasticsearch-search-analytics.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
  - output `output.broker.outputs.2`: opensearch to file (.validation-output/03-opensearch.jsonl)
- `examples/getting-started/quickstart-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/quickstart.jsonl`)
  - input `input.file.paths`: ["/tmp/expanso-quickstart/input.jsonl"] to tests/fixtures/pipeline-inputs/quickstart.jsonl
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/integrations/scada-energy-edge/scada-edge-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/scada-energy-edge.log`)
  - input `input`: socket to file (tests/fixtures/pipeline-inputs/scada-energy-edge.log)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1.file.path`: ${LOCAL_ARCHIVE_PATH:/tmp/scada-review-events.jsonl} to .validation-output/02-file.jsonl
- `examples/integrations/scada-energy-edge/step-1-parse-registers.yaml` (fixture: `tests/fixtures/pipeline-inputs/scada-energy-edge.log`)
  - input `input`: socket to file (tests/fixtures/pipeline-inputs/scada-energy-edge.log)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/integrations/scada-energy-edge/step-2-filter-nominal.yaml` (fixture: `tests/fixtures/pipeline-inputs/scada-energy-edge.log`)
  - input `input`: socket to file (tests/fixtures/pipeline-inputs/scada-energy-edge.log)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/integrations/scada-energy-edge/step-3-classify-faults.yaml` (fixture: `tests/fixtures/pipeline-inputs/scada-energy-edge.log`)
  - input `input`: socket to file (tests/fixtures/pipeline-inputs/scada-energy-edge.log)
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/integrations/scada-energy-edge/step-4-route-destinations.yaml` (fixture: `tests/fixtures/pipeline-inputs/scada-energy-edge.log`)
  - input `input`: socket to file (tests/fixtures/pipeline-inputs/scada-energy-edge.log)
  - output `output.broker.outputs.0`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.broker.outputs.1.file.path`: ${LOCAL_ARCHIVE_PATH:/tmp/scada-review-events.jsonl} to .validation-output/02-file.jsonl
- `examples/log-processing/enrich-export-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output.broker.outputs.0`: aws_s3 to file (.validation-output/01-aws_s3.jsonl)
  - output `output.broker.outputs.0`: gzip bytes to base64 framed file
  - output `output.broker.outputs.0.aws_s3.batching`: count=200, period=2m to count=25, period=1s; batching processors retained
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
- `examples/log-processing/enrich-export.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 2s to 1ms
  - output `output`: aws_s3 to file (.validation-output/01-aws_s3.jsonl)
- `examples/log-processing/enrichment-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/log-processing/filter-severity-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/filter-severity.jsonl`)
  - input `input.file.paths`: ["/var/log/app/*.log"] to tests/fixtures/pipeline-inputs/filter-severity.jsonl
  - output `output.broker.outputs.0.switch.cases.0.output.file.path`: /var/log/expanso/errors/${!timestamp_unix_date()}.json to .validation-output/01-file.jsonl
  - output `output.broker.outputs.0.switch.cases.1.output`: stdout to file (.validation-output/02-stdout.jsonl)
  - output `output.broker.outputs.0.switch.cases.2.output.file.path`: /var/log/expanso/unrouted-logs.json to .validation-output/03-file.jsonl
- `examples/log-processing/filter-severity.yaml` (fixture: `tests/fixtures/pipeline-inputs/filter-severity.jsonl`)
  - input `input.file.paths`: ["/var/log/app/*.log"] to tests/fixtures/pipeline-inputs/filter-severity.jsonl
  - output `output.switch.cases.0.output.file.path`: /var/log/expanso/errors.json to .validation-output/01-file.jsonl
  - output `output.switch.cases.1.output`: stdout to file (.validation-output/02-stdout.jsonl)
- `examples/log-processing/filtering-foundation.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `examples/log-processing/production-pipeline-complete.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/log-processing.jsonl)
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
  - output `output.broker.outputs.2`: http_client to file (.validation-output/03-http_client.jsonl)
- `examples/log-processing/production-pipeline.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/log-processing.jsonl)
  - output `output.broker.outputs.0`: opensearch to file (.validation-output/01-opensearch.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
  - output `output.broker.outputs.2.file.path`: /var/log/expanso/logs-${!timestamp_unix()}.jsonl to .validation-output/03-file.jsonl
- `static/files/data-routing/content-routing.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output`: http_client to file (.validation-output/02-http_client.jsonl)
  - output `output.switch.cases.2.output`: opensearch to file (.validation-output/03-opensearch.jsonl)
- `static/files/data-routing/content-splitting.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.switch.cases.2.output.file.path`: /var/expanso/sensor-data/normal-${!timestamp_unix_date("2006-01-02")}.jsonl to .validation-output/03-file.jsonl
- `static/files/data-routing/priority-queues.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output.switch.cases.1.output`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.switch.cases.2.output`: kafka to file (.validation-output/03-kafka.jsonl)
  - output `output.switch.cases.3.output`: kafka to file (.validation-output/04-kafka.jsonl)
  - output `output.switch.cases.4.output`: kafka to file (.validation-output/05-kafka.jsonl)
- `static/files/data-routing/smart-buffering.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-routing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-routing.jsonl)
  - output `output.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.switch.cases.1.output`: http_client to file (.validation-output/02-http_client.jsonl)
  - output `output.switch.cases.2.output`: http_client to file (.validation-output/03-http_client.jsonl)
  - output `output.switch.cases.3.output`: http_client to file (.validation-output/04-http_client.jsonl)
- `static/files/data-security/cross-border-gdpr.yaml` (fixture: `tests/fixtures/pipeline-inputs/cross-border-gdpr.jsonl`)
  - input `input`: sql_select to file (tests/fixtures/pipeline-inputs/cross-border-gdpr.jsonl)
  - output `output.broker.outputs.0`: gcp_bigquery to file (.validation-output/01-gcp_bigquery.jsonl)
  - output `output.broker.outputs.1`: gcp_cloud_storage to file (.validation-output/02-gcp_cloud_storage.jsonl)
  - output `output.broker.outputs.2.file.path`: /var/log/expanso/gdpr-audit-${!timestamp_format("2006-01-02")}.jsonl to .validation-output/03-file.jsonl
- `static/files/data-security/encrypt-data.yaml` (fixture: `tests/fixtures/pipeline-inputs/encryption.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/encryption.jsonl)
  - input `input.processors`: request metadata to registered fixture request metadata
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1`: http_client to file (.validation-output/02-http_client.jsonl)
- `static/files/data-security/enforce-schema.yaml` (fixture: `tests/fixtures/pipeline-inputs/sensor-schema-input.jsonl`)
  - resource `config.pipeline.processors.2.try.0.json_schema.schema_path`: file:///etc/expanso/schemas/sensor-schema-v1.0.0.json to tests/fixtures/pipeline-inputs/sensor-schema.json
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/sensor-schema-input.jsonl)
  - output `output.broker.outputs.0.switch.cases.0.output`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1.switch.cases.0.output.file.path`: /var/log/expanso/schema-validation-dlq-${!timestamp_unix()}.jsonl to .validation-output/02-file.jsonl
  - output `output.broker.outputs.2`: http_client to file (.validation-output/03-http_client.jsonl)
- `static/files/data-transformation/aggregate-time-windows.yaml` (fixture: `tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/aggregate-time-windows.jsonl)
  - processor `pipeline.processors`: 60-second window arithmetic to 0.3-second window arithmetic for fixture execution
  - input `input.processors`: historical event timestamps to current timestamps at 1/200 time scale
  - resource `buffer.system_window`: one-minute window unit to 300ms window unit for fixture execution
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `static/files/data-transformation/deduplicate-events.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `static/files/data-transformation/normalize-timestamps.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (.validation-input/recent-timestamps.jsonl)
  - output `output.broker.outputs.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.1`: kafka to file (.validation-output/02-kafka.jsonl)
  - output `output.broker.outputs.2.switch.cases.0.output.file.path`: /var/log/expanso/timestamp-dlq.jsonl to .validation-output/03-file.jsonl
  - input `input.file`: historical normalization fixture timestamps to previous-day timestamps and matching semantic expectations
- `static/files/data-transformation/parse-logs.yaml` (fixture: `tests/fixtures/pipeline-inputs/parse-logs.jsonl`)
  - input `input.file.paths`: ["/var/log/app/*.jsonl"] to tests/fixtures/pipeline-inputs/parse-logs.jsonl
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)
- `static/files/data-transformation/transform-formats.yaml` (fixture: `tests/fixtures/pipeline-inputs/data-transformation.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/data-transformation.jsonl)
  - output `output`: kafka to file (.validation-output/01-kafka.jsonl)
  - output `output`: avro bytes to base64 framed file
- `static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml` (fixture: `tests/fixtures/pipeline-inputs/enterprise-migration.jsonl`)
  - input `input`: sql_select to file (tests/fixtures/pipeline-inputs/enterprise-migration.jsonl)
  - output `output`: gcp_bigquery to file (.validation-output/01-gcp_bigquery.jsonl)
- `static/files/enterprise-migration/nightly-backup/nightly-backup.yaml` (fixture: `tests/fixtures/pipeline-inputs/nightly-backup.jsonl`)
  - input `input`: sequence to file (tests/fixtures/pipeline-inputs/nightly-backup.jsonl)
  - output `output.switch.cases.0.output`: gcp_cloud_storage to file (.validation-output/01-gcp_cloud_storage.jsonl)
  - output `output.switch.cases.0.output`: parquet bytes to file after Parquet decoding
  - output `output.switch.cases.0.output.gcp_cloud_storage.batching`: count=10000, period=60s to count=25, period=1s; batching processors retained
  - output `output.switch.cases.1.output`: gcp_cloud_storage to file (.validation-output/02-gcp_cloud_storage.jsonl)
  - output `output.switch.cases.1.output`: parquet bytes to file after Parquet decoding
  - output `output.switch.cases.1.output.gcp_cloud_storage.batching`: count=50000, period=120s to count=25, period=1s; batching processors retained
  - output `output.switch.cases.2.output`: gcp_cloud_storage to file (.validation-output/03-gcp_cloud_storage.jsonl)
  - output `output.switch.cases.2.output`: parquet bytes to file after Parquet decoding
  - output `output.switch.cases.2.output.gcp_cloud_storage.batching`: count=10000, period=60s to count=25, period=1s; batching processors retained
  - output `output.switch.cases.3.output`: gcp_cloud_storage to file (.validation-output/04-gcp_cloud_storage.jsonl)
- `static/files/first-results/filter-logs.yaml` (fixture: `none`)
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `static/files/first-results/process-locally.yaml` (fixture: `none`)
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `static/files/first-results/remove-pii.yaml` (fixture: `tests/fixtures/pipeline-inputs/remove-pii.jsonl`)
  - input `input.generate.interval`: 1s to 1ms
  - output `output`: stdout to file (.validation-output/01-stdout.jsonl)
- `static/files/log-processing/enrich-export.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 2s to 1ms
  - output `output`: aws_s3 to file (.validation-output/01-aws_s3.jsonl)
- `static/files/log-processing/filter-severity.yaml` (fixture: `tests/fixtures/pipeline-inputs/filter-severity.jsonl`)
  - input `input.file.paths`: ["/var/log/app/*.log"] to tests/fixtures/pipeline-inputs/filter-severity.jsonl
  - output `output.switch.cases.0.output.file.path`: /var/log/expanso/errors.json to .validation-output/01-file.jsonl
  - output `output.switch.cases.1.output`: stdout to file (.validation-output/02-stdout.jsonl)
- `static/files/log-processing/production-pipeline.yaml` (fixture: `tests/fixtures/pipeline-inputs/log-processing.jsonl`)
  - input `input`: http_server to file (tests/fixtures/pipeline-inputs/log-processing.jsonl)
  - output `output.broker.outputs.0`: opensearch to file (.validation-output/01-opensearch.jsonl)
  - output `output.broker.outputs.1`: aws_s3 to file (.validation-output/02-aws_s3.jsonl)
  - output `output.broker.outputs.2.file.path`: /var/log/expanso/logs-${!timestamp_unix()}.jsonl to .validation-output/03-file.jsonl
- `static/pipelines/motherduck-retail-pipeline.yaml` (fixture: `none`)
  - input `input.generate.count`: unbounded to 25
  - input `input.generate.interval`: 100ms to 1ms
  - output `output`: aws_s3 to file (.validation-output/01-aws_s3.jsonl)
  - output `output`: parquet bytes to file after Parquet decoding
  - output `output.aws_s3.batching`: count=1000, period=10s to count=25, period=1s; batching processors retained
- `static/pipelines/oran-telco-pipeline.yaml` (fixture: `tests/fixtures/pipeline-inputs/oran-telco-pipeline.jsonl`)
  - input `input`: broker to file (tests/fixtures/pipeline-inputs/oran-telco-pipeline.jsonl)
  - output `output.broker.outputs.0.fallback.0`: http_client to file (.validation-output/01-http_client.jsonl)
  - output `output.broker.outputs.0.fallback.1.file.path`: /data/dead-letter/otel-${! now().ts_format("2006-01-02") }.jsonl to .validation-output/02-file.jsonl
  - output `output.broker.outputs.1.broker.batching`: {"count":10000,"period":"5m"} to count=25, period=1s; batching processors retained
  - output `output.broker.outputs.1.broker.outputs.0.file.path`: /data/oran-telemetry/date=${! now().ts_format("2006-01-02") }/node=${! env("NODE_ID").or("unknown") }/part-${! uuid_v4() }.parquet to .validation-output/03-file.jsonl
  - output `output.broker.outputs.1.broker.outputs.0`: parquet bytes to file after Parquet decoding
  - output `output.broker.outputs.2.fallback.0`: kafka to file (.validation-output/04-kafka.jsonl)
  - output `output.broker.outputs.2.fallback.1.file.path`: /data/dead-letter/kafka-${! now().ts_format("2006-01-02") }.jsonl to .validation-output/05-file.jsonl
- `static/pipelines/splunk-production-pipeline.yaml` (fixture: `tests/fixtures/pipeline-inputs/splunk-edge-processing.log`)
  - input `input.file.paths`: ["/var/log/app/*.log"] to tests/fixtures/pipeline-inputs/splunk-edge-processing.log
  - output `output`: http_client to file (.validation-output/01-http_client.jsonl)

</details>

## Fragments and partial snippets

These files are tutorial steps or component snippets, not complete pipelines. They are validated but never run.

| File | Kind | Validate | Detail |
|---|---|---|---|
| [examples/data-routing/circuit-breakers.yaml](../../examples/data-routing/circuit-breakers.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/foundation.yaml](../../examples/data-routing/foundation.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/input.yaml](../../examples/data-routing/input.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/pipeline.yaml](../../examples/data-routing/pipeline.yaml) | fragment | FAIL (wrapped) | Unknown field 'field' in unarchive component |
| [examples/data-routing/step-0-no-protection.yaml](../../examples/data-routing/step-0-no-protection.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-1-classify.yaml](../../examples/data-routing/step-1-classify.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-1-http-circuit-breakers.yaml](../../examples/data-routing/step-1-http-circuit-breakers.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-1-severity-routing.yaml](../../examples/data-routing/step-1-severity-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'id' in switch component |
| [examples/data-routing/step-2-database-circuit-breakers.yaml](../../examples/data-routing/step-2-database-circuit-breakers.yaml) | fragment | FAIL (wrapped) | Missing required field 'resource' in cache component |
| [examples/data-routing/step-2-geographic-routing.yaml](../../examples/data-routing/step-2-geographic-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'topic' in switch component |
| [examples/data-routing/step-2-tier-enhancement.yaml](../../examples/data-routing/step-2-tier-enhancement.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-3-event-type-routing.yaml](../../examples/data-routing/step-3-event-type-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'addresses' in switch component |
| [examples/data-routing/step-3-multi-criteria.yaml](../../examples/data-routing/step-3-multi-criteria.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-3-multi-level-fallback.yaml](../../examples/data-routing/step-3-multi-level-fallback.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-3-priority-output.yaml](../../examples/data-routing/step-3-priority-output.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-routing/step-4-priority-routing.yaml](../../examples/data-routing/step-4-priority-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'addresses' in switch component |
| [examples/data-routing/step-4-starvation-prevention.yaml](../../examples/data-routing/step-4-starvation-prevention.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/encryption-patterns.yaml](../../examples/data-security/encryption-patterns.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-0-no-validation.yaml](../../examples/data-security/step-0-no-validation.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-1-define-schema.yaml](../../examples/data-security/step-1-define-schema.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'validate_json_schema':   |
| [examples/data-security/step-1-delete-card.yaml](../../examples/data-security/step-1-delete-card.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-1-delete-payment.yaml](../../examples/data-security/step-1-delete-payment.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-1-encrypt-card.yaml](../../examples/data-security/step-1-encrypt-card.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'encrypt_aes_gcm':  root |
| [examples/data-security/step-1-payment-encryption.yaml](../../examples/data-security/step-1-payment-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:  root |
| [examples/data-security/step-2-delete-expiry.yaml](../../examples/data-security/step-2-delete-expiry.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-2-encrypt-pii.yaml](../../examples/data-security/step-2-encrypt-pii.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'encrypt_aes_gcm':  root |
| [examples/data-security/step-2-hash-ip.yaml](../../examples/data-security/step-2-hash-ip.yaml) | fragment | FAIL (wrapped) | Expected import, map, or assignment (found '.hash' instead) |
| [examples/data-security/step-2-pii-encryption.yaml](../../examples/data-security/step-2-pii-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:  root |
| [examples/data-security/step-2-validate-route-dlq.yaml](../../examples/data-security/step-2-validate-route-dlq.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'validate_json_schema' |
| [examples/data-security/step-3-address-encryption.yaml](../../examples/data-security/step-3-address-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:  root |
| [examples/data-security/step-3-encrypt-address.yaml](../../examples/data-security/step-3-encrypt-address.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'encrypt_aes_gcm':  root |
| [examples/data-security/step-3-hash-email.yaml](../../examples/data-security/step-3-hash-email.yaml) | fragment | FAIL (wrapped) | Expected import, map, or assignment (found '.hash' instead) |
| [examples/data-security/step-3-monitor-quality-metrics.yaml](../../examples/data-security/step-3-monitor-quality-metrics.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'validate_json_schema' |
| [examples/data-security/step-4-add-metadata.yaml](../../examples/data-security/step-4-add-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-4-pseudonymize-user.yaml](../../examples/data-security/step-4-pseudonymize-user.yaml) | fragment | FAIL (wrapped) | Expected import, map, or assignment (found '.hash' instead) |
| [examples/data-security/step-4-temporal-encryption.yaml](../../examples/data-security/step-4-temporal-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:   # R |
| [examples/data-security/step-5-generalize-location.yaml](../../examples/data-security/step-5-generalize-location.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-security/step-5-production.yaml](../../examples/data-security/step-5-production.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-transformation/step-1-format-detection.yaml](../../examples/data-transformation/step-1-format-detection.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-transformation/step-1-hash-based.yaml](../../examples/data-transformation/step-1-hash-based.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'cap' |
| [examples/data-transformation/step-1-json-to-avro.yaml](../../examples/data-transformation/step-1-json-to-avro.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'avro' |
| [examples/data-transformation/step-1-parse-formats.yaml](../../examples/data-transformation/step-1-parse-formats.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-transformation/step-1-tumbling-window.yaml](../../examples/data-transformation/step-1-tumbling-window.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'json' |
| [examples/data-transformation/step-2-avro-to-parquet.yaml](../../examples/data-transformation/step-2-avro-to-parquet.yaml) | fragment | FAIL (wrapped) | Unknown field 'codec' in aws_s3 component |
| [examples/data-transformation/step-2-fingerprint-based.yaml](../../examples/data-transformation/step-2-fingerprint-based.yaml) | fragment | FAIL (wrapped) | Expected } (found '= cac' instead) |
| [examples/data-transformation/step-2-json-parsing.yaml](../../examples/data-transformation/step-2-json-parsing.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-transformation/step-2-normalize-utc.yaml](../../examples/data-transformation/step-2-normalize-utc.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-transformation/step-2-sliding-window.yaml](../../examples/data-transformation/step-2-sliding-window.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'json' |
| [examples/data-transformation/step-3-auto-detect.yaml](../../examples/data-transformation/step-3-auto-detect.yaml) | fragment | FAIL (wrapped) | Expected line break (unexpected end of expression) |
| [examples/data-transformation/step-3-csv-parsing.yaml](../../examples/data-transformation/step-3-csv-parsing.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'csv' |
| [examples/data-transformation/step-3-id-based.yaml](../../examples/data-transformation/step-3-id-based.yaml) | fragment | FAIL (wrapped) | Expected } (found '= cac' instead) |
| [examples/data-transformation/step-3-session-window.yaml](../../examples/data-transformation/step-3-session-window.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'json' |
| [examples/data-transformation/step-4-access-log-parsing.yaml](../../examples/data-transformation/step-4-access-log-parsing.yaml) | fragment | PASS (wrapped) |  |
| [examples/data-transformation/step-5-syslog-parsing.yaml](../../examples/data-transformation/step-5-syslog-parsing.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/aggregate-time-windows/02-tumbling-window-aggregation.yaml](../../examples/explorer-stages/aggregate-time-windows/02-tumbling-window-aggregation.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'json' |
| [examples/explorer-stages/aggregate-time-windows/03-sliding-window-trends.yaml](../../examples/explorer-stages/aggregate-time-windows/03-sliding-window-trends.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'json' |
| [examples/explorer-stages/aggregate-time-windows/04-session-based-activity-clustering.yaml](../../examples/explorer-stages/aggregate-time-windows/04-session-based-activity-clustering.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'json' |
| [examples/explorer-stages/circuit-breakers/01-no-circuit-breakers.yaml](../../examples/explorer-stages/circuit-breakers/01-no-circuit-breakers.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/circuit-breakers/02-http-circuit-breakers.yaml](../../examples/explorer-stages/circuit-breakers/02-http-circuit-breakers.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/circuit-breakers/03-database-circuit-breakers.yaml](../../examples/explorer-stages/circuit-breakers/03-database-circuit-breakers.yaml) | fragment | FAIL (wrapped) | Missing required field 'resource' in cache component |
| [examples/explorer-stages/circuit-breakers/04-multi-level-fallback.yaml](../../examples/explorer-stages/circuit-breakers/04-multi-level-fallback.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/content-routing/02-severity-based-routing.yaml](../../examples/explorer-stages/content-routing/02-severity-based-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'id' in switch component |
| [examples/explorer-stages/content-routing/03-geographic-routing.yaml](../../examples/explorer-stages/content-routing/03-geographic-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'topic' in switch component |
| [examples/explorer-stages/content-routing/04-event-type-routing.yaml](../../examples/explorer-stages/content-routing/04-event-type-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'addresses' in switch component |
| [examples/explorer-stages/content-routing/05-priority-queue-routing.yaml](../../examples/explorer-stages/content-routing/05-priority-queue-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'addresses' in switch component |
| [examples/explorer-stages/content-splitting/02-store-parent-context.yaml](../../examples/explorer-stages/content-splitting/02-store-parent-context.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/content-splitting/03-split-array-into-individual-messages.yaml](../../examples/explorer-stages/content-splitting/03-split-array-into-individual-messages.yaml) | fragment | FAIL (wrapped) | Unknown field 'field' in unarchive component |
| [examples/explorer-stages/content-splitting/04-restore-parent-context.yaml](../../examples/explorer-stages/content-splitting/04-restore-parent-context.yaml) | fragment | FAIL (wrapped) | Unknown field 'field' in unarchive component |
| [examples/explorer-stages/content-splitting/05-content-based-routing.yaml](../../examples/explorer-stages/content-splitting/05-content-based-routing.yaml) | fragment | FAIL (wrapped) | Unknown field 'field' in unarchive component |
| [examples/explorer-stages/deduplicate-events/01-original-events.yaml](../../examples/explorer-stages/deduplicate-events/01-original-events.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/deduplicate-events/02-hash-based-deduplication.yaml](../../examples/explorer-stages/deduplicate-events/02-hash-based-deduplication.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'cap' |
| [examples/explorer-stages/deduplicate-events/03-fingerprint-based-deduplication.yaml](../../examples/explorer-stages/deduplicate-events/03-fingerprint-based-deduplication.yaml) | fragment | FAIL (wrapped) | Expected } (found '= cac' instead) |
| [examples/explorer-stages/deduplicate-events/04-id-based-deduplication.yaml](../../examples/explorer-stages/deduplicate-events/04-id-based-deduplication.yaml) | fragment | FAIL (wrapped) | Expected } (found '= cac' instead) |
| [examples/explorer-stages/deduplicate-events/05-external-cache-configuration.yaml](../../examples/explorer-stages/deduplicate-events/05-external-cache-configuration.yaml) | fragment | FAIL (wrapped) | Missing required field 'url' |
| [examples/explorer-stages/encrypt-data/01-original-payment-data.yaml](../../examples/explorer-stages/encrypt-data/01-original-payment-data.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/encrypt-data/02-encrypt-credit-card-data.yaml](../../examples/explorer-stages/encrypt-data/02-encrypt-credit-card-data.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'encrypt_aes_gcm':  root |
| [examples/explorer-stages/encrypt-data/03-encrypt-pii-customer-data.yaml](../../examples/explorer-stages/encrypt-data/03-encrypt-pii-customer-data.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'encrypt_aes_gcm':  root |
| [examples/explorer-stages/encrypt-data/04-encrypt-address-data.yaml](../../examples/explorer-stages/encrypt-data/04-encrypt-address-data.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'encrypt_aes_gcm':  root |
| [examples/explorer-stages/encrypt-data/05-add-encryption-metadata.yaml](../../examples/explorer-stages/encrypt-data/05-add-encryption-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/encrypt-data/06-complete-encrypted-transaction.yaml](../../examples/explorer-stages/encrypt-data/06-complete-encrypted-transaction.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/encryption-patterns/02-payment-field-encryption.yaml](../../examples/explorer-stages/encryption-patterns/02-payment-field-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:  root |
| [examples/explorer-stages/encryption-patterns/03-identity-field-encryption.yaml](../../examples/explorer-stages/encryption-patterns/03-identity-field-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:  root |
| [examples/explorer-stages/encryption-patterns/04-address-data-encryption-location-privacy.yaml](../../examples/explorer-stages/encryption-patterns/04-address-data-encryption-location-privacy.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:  root |
| [examples/explorer-stages/encryption-patterns/05-temporal-field-encryption.yaml](../../examples/explorer-stages/encryption-patterns/05-temporal-field-encryption.yaml) | fragment | FAIL (wrapped) | Missing parameter: iv:   # R |
| [examples/explorer-stages/encryption-patterns/06-illustrative-key-version-metadata.yaml](../../examples/explorer-stages/encryption-patterns/06-illustrative-key-version-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/enforce-schema/01-no-validation.yaml](../../examples/explorer-stages/enforce-schema/01-no-validation.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/enforce-schema/02-define-json-schema.yaml](../../examples/explorer-stages/enforce-schema/02-define-json-schema.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'validate_json_schema':   |
| [examples/explorer-stages/enforce-schema/03-validate-route.yaml](../../examples/explorer-stages/enforce-schema/03-validate-route.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'validate_json_schema' |
| [examples/explorer-stages/enforce-schema/04-monitor-quality.yaml](../../examples/explorer-stages/enforce-schema/04-monitor-quality.yaml) | fragment | FAIL (wrapped) | Unrecognised method 'validate_json_schema' |
| [examples/explorer-stages/enrich-export/01-original-log-data.yaml](../../examples/explorer-stages/enrich-export/01-original-log-data.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/enrich-export/02-add-lineage-metadata.yaml](../../examples/explorer-stages/enrich-export/02-add-lineage-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/enrich-export/03-restructure-to-event-metadata.yaml](../../examples/explorer-stages/enrich-export/03-restructure-to-event-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/enrich-export/04-configure-batching.yaml](../../examples/explorer-stages/enrich-export/04-configure-batching.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/enrich-export/05-configured-s3-object.yaml](../../examples/explorer-stages/enrich-export/05-configured-s3-object.yaml) | fragment | FAIL (wrapped) | Expected number, got string |
| [examples/explorer-stages/filter-severity/01-all-log-levels-mixed.yaml](../../examples/explorer-stages/filter-severity/01-all-log-levels-mixed.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/filter-severity/02-parse-classify.yaml](../../examples/explorer-stages/filter-severity/02-parse-classify.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/filter-severity/03-filter-route.yaml](../../examples/explorer-stages/filter-severity/03-filter-route.yaml) | fragment | FAIL (wrapped) | Missing required field 'id' in switch component |
| [examples/explorer-stages/normalize-timestamps/01-mixed-timestamp-formats.yaml](../../examples/explorer-stages/normalize-timestamps/01-mixed-timestamp-formats.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/normalize-timestamps/02-parse-multiple-formats.yaml](../../examples/explorer-stages/normalize-timestamps/02-parse-multiple-formats.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/normalize-timestamps/03-normalize-to-utc-metadata.yaml](../../examples/explorer-stages/normalize-timestamps/03-normalize-to-utc-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/oran-telco-pipeline/01-adapter-output.yaml](../../examples/explorer-stages/oran-telco-pipeline/01-adapter-output.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/oran-telco-pipeline/02-parse-authored-fields.yaml](../../examples/explorer-stages/oran-telco-pipeline/02-parse-authored-fields.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/oran-telco-pipeline/03-add-review-metadata.yaml](../../examples/explorer-stages/oran-telco-pipeline/03-add-review-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/oran-telco-pipeline/04-select-review-candidates.yaml](../../examples/explorer-stages/oran-telco-pipeline/04-select-review-candidates.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/oran-telco-pipeline/05-external-destinations.yaml](../../examples/explorer-stages/oran-telco-pipeline/05-external-destinations.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/parse-logs/01-original-input.yaml](../../examples/explorer-stages/parse-logs/01-original-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/parse-logs/02-format-detection.yaml](../../examples/explorer-stages/parse-logs/02-format-detection.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/parse-logs/03-json-log-parsing.yaml](../../examples/explorer-stages/parse-logs/03-json-log-parsing.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/parse-logs/04-csv-data-parsing.yaml](../../examples/explorer-stages/parse-logs/04-csv-data-parsing.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'csv' |
| [examples/explorer-stages/parse-logs/05-access-log-parsing.yaml](../../examples/explorer-stages/parse-logs/05-access-log-parsing.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/parse-logs/06-syslog-message-parsing.yaml](../../examples/explorer-stages/parse-logs/06-syslog-message-parsing.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/priority-queues/01-original-input.yaml](../../examples/explorer-stages/priority-queues/01-original-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/priority-queues/02-severity-based-routing.yaml](../../examples/explorer-stages/priority-queues/02-severity-based-routing.yaml) | fragment | FAIL (wrapped) | Missing required field 'addresses' in switch component |
| [examples/explorer-stages/priority-queues/03-customer-tier-enhancement.yaml](../../examples/explorer-stages/priority-queues/03-customer-tier-enhancement.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/priority-queues/04-multi-criteria-scoring.yaml](../../examples/explorer-stages/priority-queues/04-multi-criteria-scoring.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/production-pipeline/01-raw-http-input.yaml](../../examples/explorer-stages/production-pipeline/01-raw-http-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/production-pipeline/02-parse-validate.yaml](../../examples/explorer-stages/production-pipeline/02-parse-validate.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/production-pipeline/03-enrich-metadata.yaml](../../examples/explorer-stages/production-pipeline/03-enrich-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/production-pipeline/04-filter-score.yaml](../../examples/explorer-stages/production-pipeline/04-filter-score.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/production-pipeline/05-redact-pii.yaml](../../examples/explorer-stages/production-pipeline/05-redact-pii.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/production-pipeline/06-fan-out.yaml](../../examples/explorer-stages/production-pipeline/06-fan-out.yaml) | fragment | FAIL (wrapped) | Missing required field 'id' in broker component |
| [examples/explorer-stages/scada-energy-edge/01-adapter-output.yaml](../../examples/explorer-stages/scada-energy-edge/01-adapter-output.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/scada-energy-edge/02-parse-decoded-fields.yaml](../../examples/explorer-stages/scada-energy-edge/02-parse-decoded-fields.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/scada-energy-edge/03-select-and-label.yaml](../../examples/explorer-stages/scada-energy-edge/03-select-and-label.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/scada-energy-edge/04-route-selected-records.yaml](../../examples/explorer-stages/scada-energy-edge/04-route-selected-records.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/smart-buffering/01-original-input.yaml](../../examples/explorer-stages/smart-buffering/01-original-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/smart-buffering/02-priority-classification.yaml](../../examples/explorer-stages/smart-buffering/02-priority-classification.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/smart-buffering/03-priority-output-routing.yaml](../../examples/explorer-stages/smart-buffering/03-priority-output-routing.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/smart-buffering/04-starvation-prevention.yaml](../../examples/explorer-stages/smart-buffering/04-starvation-prevention.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/splunk-edge-processing/01-authored-log-fixture.yaml](../../examples/explorer-stages/splunk-edge-processing/01-authored-log-fixture.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/splunk-edge-processing/02-parse-selected-fields.yaml](../../examples/explorer-stages/splunk-edge-processing/02-parse-selected-fields.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/splunk-edge-processing/03-apply-a-retention-policy.yaml](../../examples/explorer-stages/splunk-edge-processing/03-apply-a-retention-policy.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/splunk-edge-processing/04-add-hec-metadata.yaml](../../examples/explorer-stages/splunk-edge-processing/04-add-hec-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/splunk-edge-processing/05-route-to-splunk-hec.yaml](../../examples/explorer-stages/splunk-edge-processing/05-route-to-splunk-hec.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/transform-formats/01-json-input.yaml](../../examples/explorer-stages/transform-formats/01-json-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/explorer-stages/transform-formats/02-json-avro.yaml](../../examples/explorer-stages/transform-formats/02-json-avro.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'avro' |
| [examples/explorer-stages/transform-formats/03-avro-parquet.yaml](../../examples/explorer-stages/transform-formats/03-avro-parquet.yaml) | fragment | FAIL (wrapped) | Unknown field 'codec' in aws_s3 component |
| [examples/explorer-stages/transform-formats/04-auto-detection.yaml](../../examples/explorer-stages/transform-formats/04-auto-detection.yaml) | fragment | FAIL (wrapped) | Expected line break (unexpected end of expression) |
| [examples/integrations/oran-input.yaml](../../examples/integrations/oran-input.yaml) | fragment | FAIL (wrapped) | Unknown component or field 'prometheus_input' |
| [examples/integrations/oran-output.yaml](../../examples/integrations/oran-output.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/oran-step-1-parse.yaml](../../examples/integrations/oran-step-1-parse.yaml) | fragment | FAIL (wrapped) | Invalid syntax in call to fold() |
| [examples/integrations/oran-step-2-enrich.yaml](../../examples/integrations/oran-step-2-enrich.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/oran-step-3-filter.yaml](../../examples/integrations/oran-step-3-filter.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/scada-input.yaml](../../examples/integrations/scada-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/scada-step-1-parse.yaml](../../examples/integrations/scada-step-1-parse.yaml) | fragment | FAIL (wrapped) | Invalid syntax in call to fold() |
| [examples/integrations/scada-step-2-filter-classify.yaml](../../examples/integrations/scada-step-2-filter-classify.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/scada-step-3-route.yaml](../../examples/integrations/scada-step-3-route.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/splunk-input.yaml](../../examples/integrations/splunk-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/splunk-output.yaml](../../examples/integrations/splunk-output.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/splunk-step-1-parse.yaml](../../examples/integrations/splunk-step-1-parse.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/splunk-step-2-filter.yaml](../../examples/integrations/splunk-step-2-filter.yaml) | fragment | PASS (wrapped) |  |
| [examples/integrations/splunk-step-3-enrich.yaml](../../examples/integrations/splunk-step-3-enrich.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/input.yaml](../../examples/log-processing/input.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-0-raw-input.yaml](../../examples/log-processing/step-0-raw-input.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-0-unfiltered.yaml](../../examples/log-processing/step-0-unfiltered.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-1-lineage.yaml](../../examples/log-processing/step-1-lineage.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-1-parse-classify.yaml](../../examples/log-processing/step-1-parse-classify.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-1-parse-validate.yaml](../../examples/log-processing/step-1-parse-validate.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-2-enrich-metadata.yaml](../../examples/log-processing/step-2-enrich-metadata.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-2-filter-route.yaml](../../examples/log-processing/step-2-filter-route.yaml) | fragment | FAIL (wrapped) | Missing required field 'id' in switch component |
| [examples/log-processing/step-2-restructure.yaml](../../examples/log-processing/step-2-restructure.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-3-batching.yaml](../../examples/log-processing/step-3-batching.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-3-filter-score.yaml](../../examples/log-processing/step-3-filter-score.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-4-redact-pii.yaml](../../examples/log-processing/step-4-redact-pii.yaml) | fragment | PASS (wrapped) |  |
| [examples/log-processing/step-5-fan-out.yaml](../../examples/log-processing/step-5-fan-out.yaml) | fragment | FAIL (wrapped) | Missing required field 'id' in broker component |
| [static/files/data-routing/circuit-breakers.yaml](../../static/files/data-routing/circuit-breakers.yaml) | fragment | PASS (wrapped) |  |
| [static/files/data-routing/fan-out-pattern.yaml](../../static/files/data-routing/fan-out-pattern.yaml) | fragment | PASS (wrapped) |  |
| [static/files/data-security/encryption-patterns.yaml](../../static/files/data-security/encryption-patterns.yaml) | fragment | PASS (wrapped) |  |
