# Platform realism sweep

Date: 2026-10-06

Scope: all 26 published examples in `PUBLIC_CATALOG`. This report checks that
each canonical pipeline and its deployment contract use real platform APIs,
secure transport and authentication, persistent storage where state is
retained, and least-privilege defaults. It does not claim that external
services or a customer cluster were provisioned during this review.

Result: **pass=1 fixed=25**. The O-RAN SNO example is the reference pass from
https://github.com/expanso-io/examples.expanso.io/pull/47; the remaining 25
examples required at least one platform-realism fix.

The dated local gate inspected 26 canonical jobs, 20 public copies, 126 explorer
stages, 193 tutorial YAML blocks, and 19 deployment manifests. All 26 canonical
files passed the repository-pinned `.bin/expanso-edge` validator as typed
`pipeline-job` documents. The gate returned zero findings. An untyped job or
bare config now fails CI even if its inner pipeline happens to parse.

| Example                     | Result | Platform-realism result                                                                                                                                                                                                                                                    |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Circuit Breaker Patterns    | fixed  | Replaced placeholder fallbacks with authenticated primary and secondary HTTPS contracts.                                                                                                                                                                                   |
| Content-Based Routing       | fixed  | Added a valid PagerDuty Events API v2 envelope, authenticated Slack delivery, and the authenticated HTTPS Elasticsearch document API.                                                                                                                                      |
| Content-Based Splitting     | fixed  | Added authenticated HTTPS alerting, TLS and SCRAM Kafka, and a deployment-mounted archive path.                                                                                                                                                                            |
| Fan-Out Pattern             | fixed  | Replaced placeholder branches with TLS and SCRAM Kafka, workload-identity S3 with KMS, and the authenticated HTTPS Elasticsearch document API.                                                                                                                             |
| Priority Queues             | fixed  | Moved every queue to a TLS listener with a mounted CA and deployment-supplied SCRAM credentials.                                                                                                                                                                           |
| Smart Buffering             | fixed  | Required authenticated HTTPS for every priority output, corrected retries, and separated validation from Edge deployment in both runnable tutorials.                                                                                                                       |
| Cross-Border GDPR           | fixed  | Converted the canonical file to a typed job; added certificate-verified PostgreSQL, fail-closed HMAC pseudonyms, persistent audit storage, and separate original-record and minimized transfer branches.                                                                   |
| Encrypt Sensitive Data      | fixed  | Added proxy-bounded input, authenticated TLS and mTLS outputs, unique AES-GCM nonces, fail-closed keys, CVV deletion, and an optional TLS and SCRAM Kafka archive with a write-only topic ACL.                                                                             |
| Encryption Patterns         | fixed  | Replaced reusable IV and literal-key shapes with unique AES-GCM nonces, fail-closed deployment keys, and CVV deletion.                                                                                                                                                     |
| Enforce Schema              | fixed  | Added authenticated HTTPS analytics and metrics outputs plus a deployment-mounted dead-letter path.                                                                                                                                                                        |
| Remove PII                  | fixed  | Made the HMAC key typed and fail-closed, required authenticated ingress and Prometheus controls, and moved retained logs to persistent storage.                                                                                                                            |
| Aggregate Time Windows      | fixed  | Replaced the external analytics destination with authenticated HTTPS and secured Kafka with TLS and SCRAM.                                                                                                                                                                 |
| Deduplicate Events          | fixed  | Added atomic persistent deduplication, authenticated HTTPS delivery, and TLS and SCRAM Kafka.                                                                                                                                                                              |
| Normalize Timestamps        | fixed  | Added authenticated HTTPS delivery, TLS and SCRAM Kafka, and deployment-mounted dead-letter storage.                                                                                                                                                                       |
| Parse Structured Logs       | fixed  | Added authenticated HTTPS delivery, a persistent dead-letter path, and stable node identity after the current codec helper.                                                                                                                                                |
| Transform Formats           | fixed  | Moved Kafka delivery to TLS with a mounted CA and deployment-supplied SCRAM credentials.                                                                                                                                                                                   |
| DB2 to BigQuery             | fixed  | Converted the canonical file to a typed job; added certificate-verified Db2 ODBC, fail-closed HMAC masking, governed currency joins, correct MCC matching, and a pre-provisioned BigQuery table contract.                                                                  |
| Nightly Backup              | fixed  | Added certificate-verified PostgreSQL and replaced unrelated placeholder S3 and Parquet branches with gzip NDJSON, SHA-256 checksums, and workload-identity Google Cloud Storage.                                                                                          |
| Medical Device Intelligence | fixed  | Converted the canonical file to a typed job; added fixture and review mounts, authenticated mTLS fleet delivery, and an optional subscription-CLI analysis path with no metered API key.                                                                                   |
| MotherDuck Retail Analytics | fixed  | Converted the canonical file to a typed job; fixed current Bloblang mappings, grouped each Parquet batch by region, and required workload identity plus KMS encryption on every S3 fragment.                                                                               |
| O-RAN Telemetry             | pass   | Uses the https://github.com/expanso-io/examples.expanso.io/pull/47 SNO reference: restricted-SCC workloads, PVCs, OTLP metrics, TLS and SCRAM Kafka with ACLs, and network policy.                                                                                         |
| SCADA Energy Edge           | fixed  | Corrected the obsolete fold accumulator, kept protocol decoding at the gateway boundary, bound the feed to loopback, and added TLS and SCRAM Kafka plus persistent review storage.                                                                                         |
| Splunk Edge Processing      | fixed  | Converted the canonical file to a typed job; added valid HEC JSON and token auth, TLS, Redis deduplication, KMS-encrypted regional S3, authenticated alerts, durable metrics, persistent fallback, and an optional TLS and SCRAM Kafka mirror with a write-only topic ACL. |
| Enrich and Export           | fixed  | Removed node-local AWS profiles and required workload identity plus KMS encryption for both S3 paths.                                                                                                                                                                      |
| Filter Severity             | fixed  | Moved local outputs to deployment-managed storage and preserved Elasticsearch delivery through its authenticated HTTPS document API.                                                                                                                                       |
| Production Pipeline         | fixed  | Added authenticated HTTPS Elasticsearch, KMS-encrypted S3 with workload identity, TLS and SCRAM Kafka, and an authenticated HTTPS alert webhook.                                                                                                                           |

## History preservation

CI compares every example family with baseline commit
`d167350ffad085c267b1bbe884c5b28b6f95d03b`. The contract aggregates the
canonical pipeline, public copy, explorer stages, and tutorial configurations,
so a safe refactor may move a capability without appearing to delete it.

The 26 family contracts contain 76 explicit secure substitutions and no generic
exceptions. They identify the exact legacy control that changed and why:

- ambiguous Kafka brokers became TLS broker lists with mounted trust and SCRAM;
- plaintext or ambiguous service endpoints became authenticated HTTPS contracts;
- raw encryption-key variables became fail-closed, validated key material;
- node-local AWS profiles became scoped workload identity;
- encrypted CVV retention became deletion;
- unsupported runtime interpolation in numeric or enum fields became fixed,
  schema-valid values;
- obsolete watcher and destination labels became validated Edge components and
  actual KMS-encrypted outputs.

The generator refuses to create a new exception unless its substitution is
explicitly classified. The regression test also rejects stale, empty, or
`TODO` exceptions.

## CI policy

`npm run validate-platform-realism` is the proof for mechanically checkable
controls. It:

- validates every canonical file with the pinned Expanso Edge binary and
  requires a typed `pipeline-job`;
- checks canonical copies, explorer stages, tutorial YAML, and deployment
  manifests across all 26 published families;
- rejects placeholder or plaintext external endpoints, unauthenticated HTTP,
  invalid Pushgateway or Splunk HEC wire formats, Kafka without TLS and
  authentication, weak PostgreSQL or Db2 TLS, node-local AWS profiles, S3
  without KMS, inline secrets, `hostPath`, ephemeral output paths, and
  workloads outside the restricted non-root security baseline;
- rejects unsupported `expanso-edge run --config` instructions and any page
  that deploys a job before local Edge validation;
- checks the 26 family-level history contracts for silent feature loss.
