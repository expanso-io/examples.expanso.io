# Cross-Border GDPR Compliance Pipeline

Anonymize EU financial data before cross-border transfer to global analytics systems.

## Use Case

Your organization has:

- EU customer transaction data subject to GDPR
- Global analytics platform (BigQuery US/global)
- Requirement to aggregate data globally without violating GDPR Article 44+

**The challenge**: GDPR restricts transfer of personal data outside EU/EEA.

**The solution**: Minimize direct identifiers at the EU edge, pseudonymize the customer identifier with a deployment-owned HMAC key, and send data only after the transfer has been approved. These transformations do not by themselves make the output anonymous or remove it from GDPR scope.

## How This Differs from `remove-pii`

| Aspect     | remove-pii          | cross-border-gdpr               |
| ---------- | ------------------- | ------------------------------- |
| Focus      | General PII removal | Data residency & transfer       |
| Input      | HTTP streams        | SQL database                    |
| Data type  | User activity       | Financial transactions          |
| Output     | Single destination  | Dual: global + regional archive |
| Compliance | Generic             | GDPR Article 44 specific        |

## Minimization Strategy

### Tiered Treatment

| Field              | Treatment      | Result                                                            |
| ------------------ | -------------- | ----------------------------------------------------------------- |
| customer_name      | **DELETE**     | Removed entirely                                                  |
| customer_address   | **DELETE**     | Removed entirely                                                  |
| customer_dob       | **GENERALIZE** | Age bucket (25-34, 35-44, etc.)                                   |
| customer_id        | **HMAC**       | Stable pseudonymous ID                                            |
| customer_email     | **GENERALIZE** | Domain only (gmail.com)                                           |
| iban               | **GENERALIZE** | Country code only (DE, FR)                                        |
| ip_address         | **GENERALIZE** | /16 subnet                                                        |
| transaction_amount | **KEEP**       | Needed for aggregation; assess linkability in the complete record |

### What This Establishes

The pipeline removes the listed direct identifiers and records which transformations ran. Privacy and legal reviewers must still assess indirect identification, dataset linkage, purpose, retention, access, destination, and the transfer mechanism.

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
GDPR_CUSTOMER_HMAC_KEY=<secret-from-your-secret-manager>
GCP_GLOBAL_PROJECT=global-analytics
EU_ARCHIVE_BUCKET=eu-west-1-archive
```

## Compliance Audit Trail

Every record includes:

- `_data_origin`: Source region and extraction time
- `_gdpr_compliance`: Declared legal basis and technical minimization checks
- Separate audit log for compliance reporting

## Running

```bash
# Deploy to EU edge nodes only
expanso-cli job deploy cross-border-gdpr.yaml \
  --selector region=eu \
  --selector compliance=gdpr
```
