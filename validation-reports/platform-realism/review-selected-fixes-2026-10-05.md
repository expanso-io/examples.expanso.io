# Selected review fixes, 2026-10-05

This report covers RR1–RR9 in the assigned review phase. The fixes were applied inside the current worktree. No push, PR, CI phase, Cloud deployment, live model call, or external destination write ran.

- RR1: all three selected SSE-KMS setup contracts now grant key-scoped `kms:GenerateDataKey` alongside `kms:Encrypt`.
- RR2: the encryption-patterns download now contains the advertised payment, identity, address, temporal, and audit behavior. All six authored stages and their checkpoints match that pipeline. CVV is deleted; every encrypted field has a nonce and uses a 32-byte hexadecimal key. The fixture ciphertext decrypts to the original values. Derived analytics fields remain present.
- RR3: the pipeline assigns processing duration and a retry-stable event identifier before the monitoring branch. The authorized SQLite aggregator persists labeled event totals and request/processing duration histogram sums and counts. It deduplicates event identifiers and holds a process lock across aggregation and HTTPS publication, preventing stale snapshots from overtaking newer totals. Histograms expose an infinite bucket, count, and sum; they support mean duration, not quantiles. Pushgateway delivery remains authenticated and uses a distinct node grouping.
- RR4: regional buckets, object prefixes, client regions, and KMS keys are selected through four explicit residency routes. Region and KMS settings are static deployment variables for each S3 client, rather than message-time expressions. The extra bucket-spelling restriction was removed; KMS and workload-identity checks remain.
- RR5: critical Splunk events retain 20-record/2-second batching. The normal 100-record/10-second path and persistent fallback remain.
- RR6: the shared medical fixture loader reads `MEDICAL_FIXTURE_DIR` and overlays the actual command input for its source. The subscription-analysis contract was exercised with a local stub, without calling a model. The authored deterministic fallback remains.
- RR7: errored records are deleted at the global BigQuery boundary. The independently authorized EU archive still receives the captured original record.
- RR8/RR9: Kafka policy accepts system trust or explicit CA configuration and accepts SASL credentials or a client certificate/key pair. Missing TLS and incomplete authentication still fail.

The generator rebuilt 21 explorers and 100 stages. The policy sweep inspected 26 published catalog entries. Focused checks exercised all six encryption stages, decrypted every encrypted fixture field, checked malformed and undersized keys, exercised both GDPR branches, inspected all four residency routes and both Splunk batch policies, checked persisted metric totals and duplicate events, and used an alternate mounted medical fixture batch plus stdin overrides.

Final verification output:

```text
JavaScript/TypeScript focused tests: 15 passed, 0 failed
Medical fixture directory and command-input contract PASS
Persistent labeled metrics, restart/retry semantics, and invalid-duration rejection PASS
[OK] static/files/data-security/encryption-patterns.yaml: valid
[OK] .review/splunk-outputs.yaml: valid
Canonical Explorer stages PASS: 21 explorers / 100 stages / 100 canonical-bound / 0 unbound / 0 duplicate output paths.
```

The output harness used the changed Splunk output branches and processing-time mappings with a synthetic stdin input. It did not validate or execute the legacy file collector and all upstream Splunk parsing/filtering stages. The full source-to-destination Splunk pipeline, real S3 delivery, live Pushgateway publication, and live fleet submission remain outside this focused verification. Production must mount the metrics script and persistent state path described in the setup contract and run one sender for each state file/node grouping.

The full repository test and lint suites belong to later phases and did not run here. No agents, servers, background processes, or additional worktrees were started. Scratch files and Python caches created during these checks were removed.
