# Cross-Border GDPR Compliance Pipeline

Anonymize EU financial data before cross-border transfer to global analytics systems.

## Use Case

Your organization has:
- EU customer transaction data subject to GDPR
- Global analytics platform (BigQuery US/global)
- Requirement to aggregate data globally without violating GDPR Article 44+

**The challenge**: GDPR restricts transfer of personal data outside EU/EEA. 

**The solution**: Fully anonymize data at the EU edge before it crosses borders. Anonymized data is no longer "personal data" under GDPR.

## How This Differs from `remove-pii`

| Aspect | remove-pii | cross-border-gdpr |
|--------|-----------|-------------------|
| Focus | General PII removal | Data residency & transfer |
| Input | HTTP streams | SQL database |
| Data type | User activity | Financial transactions |
| Output | Single destination | Dual: global + regional archive |
| Compliance | Generic | GDPR Article 44 specific |

## Anonymization Strategy

### Tiered Treatment

| Field | Treatment | Result |
|-------|-----------|--------|
| customer_name | **DELETE** | Removed entirely |
| customer_address | **DELETE** | Removed entirely |
| customer_dob | **GENERALIZE** | Age bucket (25-34, 35-44, etc.) |
| customer_id | **HASH** | One-way anonymized ID |
| customer_email | **GENERALIZE** | Domain only (gmail.com) |
| iban | **GENERALIZE** | Country code only (DE, FR) |
| ip_address | **GENERALIZE** | /16 subnet |
| transaction_amount | **KEEP** | Not PII without identifier |

### Why This Works

Under GDPR, data is "personal" only if it can identify a natural person. After this pipeline:
- No direct identifiers remain
- Indirect identifiers are generalized to cohort level
- k-anonymity is effectively achieved (many people per bucket)

## Data Flow

```
EU Database ──→ [Expanso Edge in EU] ──→ Anonymized → Global BigQuery
                       │
                       └──→ Full Data → EU Regional Archive
                       │
                       └──→ Audit Log → Compliance Records
```

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

## Compliance Audit Trail

Every record includes:
- `_data_origin`: Source region and extraction time
- `_gdpr_compliance`: Legal basis, anonymization verification
- Separate audit log for compliance reporting

## Running

```bash
# Deploy to EU edge nodes only
expanso-cli job deploy cross-border-gdpr.yaml \
  --selector region=eu \
  --selector compliance=gdpr
```
