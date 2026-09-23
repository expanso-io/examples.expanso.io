import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const productionPipelineStages: Stage[] = [
  {
    id: 1,
    slug: 'raw-http-input',
    title: 'Raw HTTP Input',
    description:
      'A synthetic HTTP record before parsing, enrichment, selection, or field handling.',
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
    slug: 'parse-validate',
    title: 'Parse & Validate',
    description:
      'Parse JSON, validate schema with required fields (msg, user). Invalid logs route to DLQ for debugging. Add pipeline metadata showing when/where processing occurred.',
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
    slug: 'enrich-metadata',
    title: 'Enrich Metadata',
    description:
      'Add authored processing time, correlation, version, and node fields.',
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
    slug: 'filter-score',
    title: 'Filter & Score',
    description:
      'Apply the authored priority mapping and remove records below its configured threshold.',
    inputLines: [
      { content: '{"msg":"User login","user":"john@example.com"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Scored & Filtered:', indent: 0, type: 'highlighted' },
      { content: '{"msg":"User login",', indent: 1 },
      { content: '"priority":5}', indent: 1 },
      { content: '', indent: 0 },
      { content: 'Configured selection:', indent: 0, type: 'highlighted' },
      { content: 'Records below threshold: dropped', indent: 1 },
      { content: 'Kept: priority ≥ 4', indent: 1 },
    ],
  },
  {
    id: 5,
    slug: 'redact-pii',
    title: 'Redact PII',
    description:
      'Delete the configured source field and add an unsalted hash for the synthetic email value.',
    inputLines: [
      { content: '{"msg":"User login",', indent: 0 },
      { content: '"user":"john@example.com",', indent: 0, type: 'removed' },
      { content: '"priority":5}', indent: 0 },
    ],
    outputLines: [
      { content: 'Configured field change:', indent: 0, type: 'highlighted' },
      { content: '{"msg":"User login",', indent: 1 },
      {
        content: '"user_hash":"abc123def...",',
        indent: 1,
        type: 'highlighted',
      },
      { content: '"priority":5}', indent: 1 },
      { content: '', indent: 0 },
      { content: 'Email field: deleted', indent: 1 },
      { content: 'Hash field: still pseudonymous', indent: 1 },
    ],
  },
  {
    id: 6,
    slug: 'fan-out',
    title: 'Fan-Out',
    description:
      'Configure Elasticsearch, Kafka, and S3 outputs with one priority check on the Elasticsearch branch.',
    inputLines: [
      { content: '{"msg":"User login",', indent: 0 },
      { content: '"user_hash":"abc123",', indent: 0 },
      { content: '"priority":5}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Fan-Out Destinations:', indent: 0, type: 'highlighted' },
      { content: '1️⃣ Elasticsearch: skipped (priority < 7)', indent: 1 },
      { content: '2️⃣ Kafka: configured', indent: 1, type: 'highlighted' },
      { content: '3️⃣ S3: configured', indent: 1, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: 'Destination intent:', indent: 0, type: 'highlighted' },
      { content: 'Kafka: stream output', indent: 1 },
      { content: 'S3: object output', indent: 1 },
      { content: 'Elasticsearch: priority-gated output', indent: 1 },
    ],
  },
];
