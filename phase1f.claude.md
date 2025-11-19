Create interactive explorer for production-pipeline example:

1. Create docs/log-processing/production-pipeline-full.stages.ts with 6 stages:
   - Stage 1: Original - Raw HTTP input
   - Stage 2: Parse & Validate - Extract fields, validate schema
   - Stage 3: Enrich Metadata - Add timestamps, correlation IDs
   - Stage 4: Filter & Score - Drop low-value logs, add priority
   - Stage 5: Redact PII - Remove sensitive data
   - Stage 6: Fan-Out - Route to Kafka, S3, Elasticsearch

2. Create docs/log-processing/production-pipeline/explorer.mdx

3. Update sidebars.ts to include the explorer

This is the most complex pipeline with 6 stages.
