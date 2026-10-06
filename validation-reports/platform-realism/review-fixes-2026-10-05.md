# Review fix evidence, 2026-10-05

The assigned review phase changed source files only. No push, PR, CI, Cloud deployment, database connection, or object-store write ran.

R1–R6, R7, and R10–R12 received fixes. Encryption drops processing errors before the shared fan-out. Backups preserve partition metadata and write UUID-named objects through the Edge-supported Parquet encoder. Prometheus omits absent durations. The S3 setup guides distinguish provisioning permissions from the runtime role and include `kms:GenerateDataKey`. Currency conversion preserves the original values and reads dated rates from a governed table. The policy removes heading-only assertions and name/port heuristics; variable HTTP destinations now declare TLS in parsed configuration.

R9 is partially resolved. All six encrypt-data stage configurations and checkpoints now match its canonical field behavior, including real AES-GCM ciphertext fixtures, nonces, and CVV deletion. The sweep inspected 19 changed explorer families containing 89 stage fragments, synchronized exact shared configuration changes in two SCADA fragments, and regenerated all 21 explorers and 100 stages using the repository generator. This establishes binding consistency, not executable fidelity for every sibling.

Remaining R9 work: `encryption-patterns` still contains independently authored identity, address, and temporal encryption stages whose behavior exceeds its payment-only canonical fragment. Its payment stage still uses two-argument GCM encryption and retains encrypted CVV in authored checkpoints. Resolving the whole family requires reconciling that advertised behavior with the canonical download; this round did not delete those features or claim those checkpoints were executed. The base Splunk pipeline is invalid YAML, so the exact semantic before/after fragment comparison could not cover that family. Its current metrics payload was checked separately.

R8 remains assigned to the separate examples-validation work, as requested.

The focused verification executed the touched mappings with Benthos, validated three complete configurations with Expanso Edge v2.1.21, and called the parsed platform-policy interface. Currency lookup fixtures replaced only the external SQL response; the request mapping, response validation, result mapping, and error filter ran. The synthetic positive rate exists only in the verification fixture, never the production pipeline.

Actual final verification output:

```text
Encryption: valid output and malformed-key/input rejection PASS
Prometheus: missing and numeric durations PASS
[OK] examples/enterprise-migration/nightly-backup/nightly-backup.yaml: valid
[OK] examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml: valid
[OK] static/files/data-security/encrypt-data.yaml: valid
Backup partition and unique object names PASS
Currency conversion: preserved values and rejected missing/duplicate/invalid rates PASS
Platform policy: 26 published examples PASS
```

The repository generator reported:

```text
Canonical Explorer stages PASS: 21 explorers / 100 stages / 100 canonical-bound / 0 unbound / 0 duplicate output paths.
```

Parquet schema validation passed through the real Edge consumer. Parquet bytes, upload, restore, and production Db2 connectivity were not executed. The full test and lint suites belong to later phases and did not run here. No agents, servers, worktrees, or background processes were started. Disposable verification files were removed.
