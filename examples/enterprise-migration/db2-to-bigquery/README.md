# DB2 to BigQuery Migration Pipeline

Replace DataStage ETL with edge-native processing for migrating financial transactions from on-premise DB2 to Google BigQuery.

## Use Case

Your organization has:
- On-premise DB2 database with transaction data
- DataStage ETL jobs running nightly transformations
- Target: Google BigQuery for analytics

This pipeline runs **on or near your DB2 server**, transforming data before it leaves your premises.

## What It Does

1. **Queries DB2** via ODBC for yesterday's transactions
2. **Adds lineage metadata** for full audit trail
3. **Normalizes currency** to USD (DataStage lookup replacement)
4. **Masks account numbers** for compliance (keeps last 4 digits)
5. **Categorizes transactions** by merchant code
6. **Lands in BigQuery** partitioned by date

## Key Transformations

| Step | DataStage Equivalent | Expanso |
|------|---------------------|---------|
| Currency lookup | Lookup Stage | `branch` + `mapping` |
| Field masking | Transformer | `mapping` with slice/hash |
| Categorization | Switch/Case | `match` expression |
| Schema mapping | Transformer | `mapping` field assignment |

## Environment Variables

```bash
DB2_HOST=db2.internal.corp
DB2_PORT=50000
DB2_DATABASE=FINPROD
DB2_USER=etl_reader
DB2_PASSWORD=<secret>
GCP_PROJECT=my-analytics-project
NODE_ID=edge-node-datacenter-1
```

## Running

```bash
# Test locally
expanso-edge run --config db2-to-bigquery.yaml

# Deploy to fleet
expanso-cli job deploy db2-to-bigquery.yaml --selector region=datacenter
```

## Sample Data

- `sample-input.json` - Raw DB2 record
- `sample-output.json` - Transformed BigQuery record
