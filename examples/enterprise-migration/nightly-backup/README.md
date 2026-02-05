# Nightly Database Backup Pipeline

Simple, reliable replication of database tables to cloud cold storage for disaster recovery.

## Use Case

Your organization needs:
- Nightly backups of critical tables (orders, inventory)
- Cloud storage for DR (not on-premise tape)
- Cost-efficient storage (Nearline/Glacier class)
- Verifiable backups with checksums

## What It Does

1. **Extracts multiple tables** in sequence (orders, inventory, order_items)
2. **Adds backup metadata** (timestamp, source, version)
3. **Calculates row checksums** for integrity verification
4. **Routes to table-specific paths** in cloud storage
5. **Compresses as Parquet** for cost efficiency

## Tables Backed Up

| Table | Backup Type | Frequency |
|-------|-------------|-----------|
| orders | Incremental | Daily (last 24h) |
| inventory | Full | Daily (complete) |
| order_items | Incremental | Daily (last 24h) |

## Storage Layout

```
gs://backup-bucket/
├── backups/
│   ├── orders/
│   │   └── 2024-01-15/
│   │       └── orders-1705363200.parquet
│   ├── inventory/
│   │   └── 2024-01-15/
│   │       └── inventory-full.parquet
│   └── order_items/
│       └── 2024-01-15/
│           └── items-1705363200.parquet
```

## Environment Variables

```bash
DB_HOST=postgres.internal.corp
DB_NAME=ecommerce
DB_USER=backup_reader
DB_PASSWORD=<secret>
GCS_BACKUP_BUCKET=my-backup-bucket
NODE_ID=backup-node-1
```

## Recovery

To restore from backup:

```bash
# List available backups
gsutil ls gs://my-backup-bucket/backups/orders/

# Download specific date
gsutil cp -r gs://my-backup-bucket/backups/orders/2024-01-15/ ./restore/

# Verify checksums
# Each record contains _checksum field for validation
```

## Running

```bash
# Schedule nightly at 2 AM
expanso-cli job deploy nightly-backup.yaml --cron "0 2 * * *"
```
