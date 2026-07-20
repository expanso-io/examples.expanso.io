---
title: Example Coverage Report
contentArchetype: reference
localNavigation: true
uniqueTasks: [inspect-legacy-coverage-report]
claimIds: []
claimsVerifiedBy: codex/content-claims-verifier-v1
claimsVerifiedAt: '2026-07-18'
claimsPolicyDigest: sha256:8d1c6ede95f42b16f4068c7997e7d46d38736d2f93bbf193543b2a52b4e340ab
---

# Example Coverage Report

**Generated:** 2026-04-22

## Overview

- **Total Examples:** 18
- **Complete Examples:** 18 (100%)
- **Partial Examples:** 0 (0%)
- **Minimal Examples:** 0 (0%)
- **Average Completion:** 100%

```
████████████████████ 100%
```

## Category Breakdown

### data-routing

Circuit breakers, content routing, fan-out patterns, priority queues

- **Examples:** 6
- **Complete:** 6/6 (100%)
- **Average Completion:** 100%

| Example           | Stage File | Explorer | Index | Setup | Completion |
| ----------------- | ---------- | -------- | ----- | ----- | ---------- |
| smart-buffering   | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| priority-queues   | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| fan-out-pattern   | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| content-splitting | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| content-routing   | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| circuit-breakers  | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |

### data-security

PII removal, encryption patterns, schema enforcement, data sanitization

- **Examples:** 4
- **Complete:** 4/4 (100%)
- **Average Completion:** 100%

| Example             | Stage File | Explorer | Index | Setup | Completion |
| ------------------- | ---------- | -------- | ----- | ----- | ---------- |
| remove-pii          | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| enforce-schema      | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| encryption-patterns | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| encrypt-data        | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |

### data-transformation

Time windows, deduplication, format conversion, data enrichment

- **Examples:** 5
- **Complete:** 5/5 (100%)
- **Average Completion:** 100%

| Example                | Stage File | Explorer | Index | Setup | Completion |
| ---------------------- | ---------- | -------- | ----- | ----- | ---------- |
| transform-formats      | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| parse-logs             | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| normalize-timestamps   | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| deduplicate-events     | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| aggregate-time-windows | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |

### log-processing

Log filtering, parsing, enrichment, production pipelines

- **Examples:** 3
- **Complete:** 3/3 (100%)
- **Average Completion:** 100%

| Example             | Stage File | Explorer | Index | Setup | Completion |
| ------------------- | ---------- | -------- | ----- | ----- | ---------- |
| production-pipeline | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| filter-severity     | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |
| enrich-export       | ✅         | ✅       | ✅    | ✅    | ✅ 100%    |

## Next Steps

🎉 **All examples are complete!** Great work!

Consider:

- Adding more examples to cover additional use cases
- Improving existing examples with more detailed tutorials
- Creating cross-references between related examples

---

_This report is automatically generated. Run `npm run coverage-report` to update._
