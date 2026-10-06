# Selected review fixes, 2026-10-05

Addressed RR10, RR12, RR13, RR14, and RR15. The sweep covered four regional S3 outputs, three encryption key groups and their authored fragments, and two encryption explorer families. Residency labels and object paths retain underscores; bucket suffixes use hyphens. Archive processors set the three S3 metadata attributes through message metadata. Both explorer families retain corrected fixtures and show plaintext, removed fields, and added ciphertext and nonces.

Focused verification passed:

- `node --test tests/yaml/pipelineReviewRegression.test.mjs`: five tests passed. Runtime assertions cover both phone formats, rejection of malformed and 16/24-byte keys for all three groups, checkpoint outputs, regional metadata, critical delivery policy, and rendered explorer change states.
- Expanso Edge v2.1.21 validated the complete encrypt-data pipeline and an extracted regional S3 output graph with a stdin input. This is configuration validation, not an S3 upload or remote deployment.
- The repository generator regenerated 21 explorers and 100 canonical-bound stages, with zero unbound stages or duplicate output paths.
- `git diff --check` passed.

RR11 remains assigned to the separate examples-validation change. No complete repository test or lint suite, external deployment, or pipeline-control phase ran.
