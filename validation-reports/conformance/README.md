# Public example conformance

Latest report: 2026-10-05  
Published examples swept: 26 of 26  
Main baseline: `5a3a2af`  
Scope: criteria 1 through 5, with automated enforcement for criteria 3 through 5

The table records whole-criterion status. A cell stays pending until every part
of that criterion has evidence. Code already fixed on this branch is listed
below, but it does not turn a partly satisfied cell into a pass.

## Counts

| Measure | Pass | Fixed | Pending |
| --- | ---: | ---: | ---: |
| Example by criterion cells | 0 | 0 | 130 |
| Criterion 1: runs | 0 | 0 | 26 |
| Criterion 2: platform realism | 0 | 0 | 26 |
| Criterion 3: common page structure | 0 | 0 | 26 |
| Criterion 4: usable interaction and presentation | 0 | 0 | 26 |
| Criterion 5: features preserved across redesigns | 0 | 0 | 26 |

The zero pass count is deliberate. The criterion 1 and criterion 2 reports are
not on `main`, and three open dependencies still supply required criterion 3,
criterion 4, and criterion 5 behavior. This report does not convert an open
dependency into proof.

## Dependencies

- `RUN`: the criterion 1 validation report has not landed.
- `PLATFORM`: the criterion 2 platform-realism report has not landed.
- `UX`: https://github.com/expanso-io/examples.expanso.io/pull/45
- `INTERACTION`: https://github.com/expanso-io/examples.expanso.io/pull/46
- `ORAN`: https://github.com/expanso-io/examples.expanso.io/pull/47
- `EXPLORERS`: https://github.com/expanso-io/examples.expanso.io/pull/48

## Example by criterion

| Example | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Circuit Breaker Patterns | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Content-Based Routing | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Content-Based Splitting | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Fan-Out Pattern | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Priority Queues | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Smart Buffering | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Cross-Border GDPR | Pending: RUN | Pending: PLATFORM | Pending: UX, EXPLORERS | Pending: UX, INTERACTION, EXPLORERS | Pending: UX, EXPLORERS |
| Encrypt Sensitive Data | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Encryption Patterns | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Enforce Schema | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Remove PII | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Aggregate Time Windows | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Deduplicate Events | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Normalize Timestamps | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Parse Structured Logs | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Transform Formats | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| DB2 to BigQuery | Pending: RUN | Pending: PLATFORM | Pending: UX, EXPLORERS | Pending: UX, INTERACTION, EXPLORERS | Pending: UX, EXPLORERS |
| Nightly Backup | Pending: RUN | Pending: PLATFORM | Pending: UX, EXPLORERS | Pending: UX, INTERACTION, EXPLORERS | Pending: UX, EXPLORERS |
| Medical Device Intelligence | Pending: RUN | Pending: PLATFORM | Pending: UX, EXPLORERS | Pending: UX, INTERACTION, EXPLORERS | Pending: UX, EXPLORERS |
| MotherDuck Retail Analytics | Pending: RUN | Pending: PLATFORM | Pending: UX, EXPLORERS | Pending: UX, INTERACTION, EXPLORERS | Pending: UX, EXPLORERS |
| O-RAN Telemetry | Pending: RUN | Pending: PLATFORM, ORAN | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| SCADA Energy Edge | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Splunk Edge Processing | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Enrich and Export | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Filter Severity | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |
| Production Pipeline | Pending: RUN | Pending: PLATFORM | Pending: UX | Pending: UX, INTERACTION | Pending: UX |

## Current verification

The repository now has two class-wide gates:

- `npm run test-example-conformance` checks the 26-record inventory, generated
  stage evidence, page sources, and the history audit. On the current baseline,
  the inventory passes and the remaining failures point to `UX` and
  `EXPLORERS`.
- `npm run quality:example-conformance` runs 53 Chromium tests: one inventory
  test plus two tests for each example. On the current baseline, 22 passed and
  31 failed. Every failure stopped at the missing explorer guide or one of the
  five missing explorers. The 21 available examples passed their dark and
  light contrast checks and 320px reflow checks.

The browser gate also checks arrow-key paging without a scroll jump, success
and failure feedback beside copy and download controls, real input and output
for every stage, template order, and 320px overflow. Once `UX` and `EXPLORERS`
land, the interaction assertions will run far enough to assess `INTERACTION`.
The current `INTERACTION` implementation reports direct panel-copy and download
status at the bottom of the explorer, so the adjacent-control checks are
expected to fail until that dependency is corrected.

This branch has already restored the overview metadata and action links, added
the common run and deploy section, and supplied the missing medical-device
configuration-review route. Those are partial repairs within pending criteria,
not complete criterion passes.

## Pre-redesign feature audit

Compared commits:

- Baseline: `14e0ad6ee8d1bc69562565cd22c3afc9846cf8f5`
- Redesign: `20840242db7f7f309a44aeaa3ed002320e551b06`

The machine-readable record is
[`legacy-feature-audit.json`](./legacy-feature-audit.json). It contains 14
feature classes: 5 retained, 3 restored on this branch, and 6 pending an open
dependency.

| Feature | Status | Current proof or dependency |
| --- | --- | --- |
| Problem and outcome explanation | Retained | Overview header and narrative |
| Primary and secondary page actions | Restored | `ExampleHeader` action navigation |
| Inline explorer on every overview | Pending | 21 of 26; EXPLORERS |
| Explorer instructions and stage outline | Pending | UX |
| Numbered, previous, next, and keyboard stage navigation | Pending | 21 of 26; EXPLORERS |
| Concrete input and output for each stage | Pending | 21 of 26; EXPLORERS |
| Stage configuration and complete pipeline | Pending | 21 of 26; EXPLORERS |
| Run and deployment guidance | Restored | Common run and deploy section |
| Unfolded family sidebar | Pending | UX |
| Setup or configuration-review guide | Restored | Source and route for all 26 |
| Detailed step guides | Retained | Route ledger and published sources |
| Complete configuration and download | Retained | Bound pipeline sources and controls |
| Troubleshooting routes | Retained | Route ledger |
| Related-example links | Retained | Overview sources |

No captain-approved feature removal was found in the compared history.
