# Cross-Border GDPR Compliance Pipeline

Reference pipeline for reducing identifiers in EU financial data before a proposed cross-border transfer.

## Use Case

Your organization has:

- EU customer transaction data subject to GDPR
- Global analytics platform (BigQuery US/global)
- Requirement to aggregate data globally without violating GDPR Article 44+

**The challenge**: GDPR restricts transfer of personal data outside EU/EEA.

See the [canonical reference](../../../docs/data-security/cross-border-gdpr/complete-pipeline.mdx) for the transformation steps, output flow, and legal scope. Review the [Explorer](../../../docs/data-security/cross-border-gdpr/explorer.mdx) for sample checkpoints and the [hashing guide](../../../docs/data-security/cross-border-gdpr/step-4-hash-identifiers.mdx) for salt handling.

## Environment Variables

```bash
EU_DB_HOST=postgres.eu-west-1.internal
DB_USER=analytics_reader
DB_PASSWORD=<secret>
SOURCE_COUNTRY=DE
ANONYMIZATION_SALT=<random-secret-salt>
GCP_GLOBAL_PROJECT=global-analytics
EU_ARCHIVE_BUCKET=eu-west-1-archive
```

## Running

```bash
# Deploy to EU edge nodes only
expanso-cli job deploy cross-border-gdpr.yaml \
  --selector region=eu \
  --selector compliance=gdpr
```
