# Platform realism sweep

Date: 2026-10-05

Scope: all 26 published examples in `PUBLIC_CATALOG`. This report checks that
each canonical pipeline and its deployment contract use real platform APIs,
secure transport and authentication, persistent storage where state is
retained, and least-privilege defaults. It does not claim that external
services or a customer cluster were provisioned during this review.

Result: **pass=1 fixed=25**. The O-RAN SNO example is the reference pass from
PR 47; the remaining 25 examples required at least one platform-realism fix.
`npm run validate-platform-realism` is the CI proof for the mechanically
checkable controls and must report 26 published examples with zero findings.

| Example                     | Result | Platform-realism result                                                                                                                                                                    |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Circuit Breaker Patterns    | fixed  | Replaced the placeholder downstream URL with an authenticated HTTPS deployment contract.                                                                                                   |
| Content-Based Routing       | fixed  | Added a valid PagerDuty Events API v2 envelope, an authenticated Slack webhook contract, and Elasticsearch document delivery over TLS with an API key.                                     |
| Content-Based Splitting     | fixed  | Added authenticated HTTPS alerting, TLS and SCRAM for Kafka, and a deployment-mounted archive path.                                                                                        |
| Fan-Out Pattern             | fixed  | Replaced placeholder branches with TLS and SCRAM Kafka, workload-identity S3 with KMS, and authenticated Elasticsearch document delivery.                                                  |
| Priority Queues             | fixed  | Moved every queue to a TLS listener with a mounted CA and deployment-supplied SCRAM credentials.                                                                                           |
| Smart Buffering             | fixed  | Required authenticated HTTPS for each priority output and corrected the retry contract.                                                                                                    |
| Cross-Border GDPR           | fixed  | Added certificate-verified PostgreSQL, a deployment-owned HMAC key and audit storage, an EU archive of original records, and a minimized global branch without false anonymization claims. |
| Encrypt Sensitive Data      | fixed  | Added proxy-bounded input, authenticated TLS and mTLS outputs, unique AES-GCM nonces, deployment-owned keys, and deletion of CVV data.                                                     |
| Encryption Patterns         | fixed  | Replaced reusable IV and literal-key shapes with unique AES-GCM nonces, deployment-owned keys, and CVV deletion.                                                                           |
| Enforce Schema              | fixed  | Added authenticated HTTPS analytics and metrics outputs plus a deployment-mounted dead-letter path.                                                                                        |
| Remove PII                  | fixed  | Required authenticated ingress and Prometheus access controls plus a persistent deployment mount for `/var/log/expanso`.                                                                   |
| Aggregate Time Windows      | fixed  | Replaced the external analytics destination with an authenticated HTTPS contract.                                                                                                          |
| Deduplicate Events          | fixed  | Replaced the external destination with an authenticated HTTPS contract.                                                                                                                    |
| Normalize Timestamps        | fixed  | Added authenticated HTTPS delivery, TLS and SCRAM Kafka, and deployment-mounted dead-letter storage.                                                                                       |
| Parse Structured Logs       | fixed  | Replaced the external destination with an authenticated HTTPS contract.                                                                                                                    |
| Transform Formats           | fixed  | Moved Kafka delivery to a TLS listener with a mounted CA and deployment-supplied SCRAM credentials.                                                                                        |
| DB2 to BigQuery             | fixed  | Added certificate-verified Db2 ODBC, deployment-owned HMAC keys, source-preserving currency fields, correct MCC matching, and a pre-provisioned BigQuery table contract.                   |
| Nightly Backup              | fixed  | Added certificate-verified PostgreSQL and replaced placeholder Parquet claims with gzip NDJSON logical exports and SHA-256 checksums to pre-provisioned storage.                           |
| Medical Device Intelligence | fixed  | Added fixture and review mounts, an authenticated mTLS fleet endpoint, and an optional subscription-CLI analysis path with no metered API key.                                             |
| MotherDuck Retail Analytics | fixed  | Required workload identity and KMS encryption for the partitioned S3 output.                                                                                                               |
| O-RAN Telemetry             | pass   | Uses the PR 47 SNO reference: restricted-SCC workloads, PVCs, OTLP metrics, TLS and SCRAM Kafka with ACLs, and network policy.                                                             |
| SCADA Energy Edge           | fixed  | Kept protocol decoding at the gateway boundary, bound the decoded feed to loopback, and added TLS and SCRAM Kafka plus persistent review storage.                                          |
| Splunk Edge Processing      | fixed  | Added a valid Splunk HEC envelope and token, Prometheus text exposition, KMS-encrypted S3 with workload identity, authenticated HTTPS alerting, and persistent fallback storage.           |
| Enrich and Export           | fixed  | Removed node-local AWS profiles and required workload identity plus KMS encryption for both S3 paths.                                                                                      |
| Filter Severity             | fixed  | Moved retained error and unrouted records from ephemeral storage to a deployment-managed output path.                                                                                      |
| Production Pipeline         | fixed  | Added authenticated HTTPS Elasticsearch, KMS-encrypted S3 with workload identity, and an authenticated HTTPS alert webhook.                                                                |

## CI policy

The platform-realism gate parses canonical YAML and deployment manifests and
requires a deployment contract or runbook for every catalog entry. It
rejects placeholder and plaintext external endpoints, unauthenticated HTTP
outputs, invalid Pushgateway and Splunk HEC media or auth contracts, plaintext
or unauthenticated Kafka, missing Kafka trust roots, weak PostgreSQL or Db2
TLS, node-local AWS profiles, literal bucket defaults, S3 without KMS,
compressed GCS objects without encoding metadata, inline secrets, `hostPath`,
ephemeral output paths, and Kubernetes workloads outside the restricted
non-root security baseline. It also verifies required platform components for
every published catalog entry and parses every YAML document in a
multi-document manifest.
