# Public example conformance

- Latest report: [2026-10-06](./2026-10-06.md)
- Published examples swept: 26 of 26
- Main baseline: `bbbd5d5`
- Scope: criteria 1 through 5

`Pass` means the dated evidence passed without a repair owned by this
conformance sweep. `Fixed` means a reported class defect was repaired and the
current gate passes. `Pending` means the required class-wide evidence has not
landed; it is not treated as a pass.

## Counts

| Measure                                          | Pass | Fixed | Pending |
| ------------------------------------------------ | ---: | ----: | ------: |
| Example by criterion cells                       |   26 |    79 |      25 |
| Criterion 1: runs                                |   26 |     0 |       0 |
| Criterion 2: platform realism                    |    0 |     1 |      25 |
| Criterion 3: common page structure               |    0 |    26 |       0 |
| Criterion 4: usable interaction and presentation |    0 |    26 |       0 |
| Criterion 5: features preserved across redesigns |    0 |    26 |       0 |

The counts cover 130 cells: 26 published examples times five criteria.

## Evidence sources

- Criterion 1: the dated [pipeline validation report](../2026-10-06/README.md)
  records 106 of 106 complete pipelines validating and running with
  `expanso-edge` v2.1.22, with expected output checked. Each of the 26
  published families owns at least one complete pipeline in that passing set.
- Criterion 2: the landed
  [O-RAN platform repair](https://github.com/expanso-io/examples.expanso.io/pull/47)
  supplies OpenShift SNO manifests, TLS and SCRAM authentication, PVC-backed
  storage, restricted-SCC deployment, and least-privilege network and Kafka
  policy. No class-wide platform-realism report has landed for the other 25
  examples, so those cells remain pending.
- Criteria 3 and 4: `npm run test-example-conformance` passed 4 of 4 source
  contracts, and `npm run quality:example-conformance` passed 80 of 80 browser
  tests across all 26 examples on 2026-10-06.
- Criterion 5: the source and browser gates verify all 14 pre-redesign
  features listed below. No captain-approved removal was found.

## Example by criterion

| Example                     | 1: Runs | 2: Platform | 3: Structure | 4: Usability | 5: Preserved |
| --------------------------- | ------- | ----------- | ------------ | ------------ | ------------ |
| Circuit Breaker Patterns    | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Content-Based Routing       | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Content-Based Splitting     | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Fan-Out Pattern             | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Priority Queues             | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Smart Buffering             | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Cross-Border GDPR           | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Encrypt Sensitive Data      | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Encryption Patterns         | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Enforce Schema              | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Remove PII                  | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Aggregate Time Windows      | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Deduplicate Events          | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Normalize Timestamps        | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Parse Structured Logs       | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Transform Formats           | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| DB2 to BigQuery             | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Nightly Backup              | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Medical Device Intelligence | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| MotherDuck Retail Analytics | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| O-RAN Telemetry             | Pass    | Fixed       | Fixed        | Fixed        | Fixed        |
| SCADA Energy Edge           | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Splunk Edge Processing      | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Enrich and Export           | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Filter Severity             | Pass    | Pending     | Fixed        | Fixed        | Fixed        |
| Production Pipeline         | Pass    | Pending     | Fixed        | Fixed        | Fixed        |

## What the gates enforce

The source gate fails unless the inventory contains exactly 26 published
examples, each has an overview, explorer, setup route, complete-pipeline
source, and canonical stages with non-empty input, output, configuration, and a
material transformation.

The browser gate runs three checks per example plus two inventory regressions.
It verifies explanation, explorer guide, stage explorer, and run/deploy order;
real rendered input and output for every stage; arrow-key paging without a
scroll jump; fresh success and failure feedback beside each copy or download
control; every preserved action, related-example link, and published sidebar
route; WCAG AA text contrast in dark and light themes; and no horizontal
overflow at 320px.

## Pre-redesign feature audit

Compared commits:

- Baseline: `14e0ad6ee8d1bc69562565cd22c3afc9846cf8f5`
- Redesign: `20840242db7f7f309a44aeaa3ed002320e551b06`

The machine-readable evidence is in
[`legacy-feature-audit.json`](./legacy-feature-audit.json). The current list is:

| Feature                 | History evidence                         | Current proof                             | Status   |
| ----------------------- | ---------------------------------------- | ----------------------------------------- | -------- |
| Explanation             | Overview pages                           | Explanation section on all 26 overviews   | Retained |
| Page actions            | Overview Get Started links               | Example action navigation                 | Restored |
| Inline explorer         | DataPipelineExplorer and explorer routes | Explorer V2 on all 26 overviews           | Restored |
| Explorer guide          | Overview guidance                        | Guide before every explorer               | Restored |
| Stage navigation        | Numbered rail and keyboard handler       | Controls and keyboard paging on all 26    | Restored |
| Stage input and output  | Input and output columns                 | Generated and rendered evidence on all 26 | Restored |
| Stage configuration     | Pipeline step panel                      | Stage and full YAML bindings on all 26    | Restored |
| Run and deploy guidance | Setup and complete-pipeline links        | Run and deploy section on all 26          | Restored |
| Family sidebar          | Pre-redesign `sidebars.ts`               | Every published child route is reachable  | Restored |
| Setup guides            | `setup.mdx` routes                       | Setup source and route for all 26         | Restored |
| Step guides             | `step-*.mdx` routes                      | Route ledger and family sidebar           | Retained |
| Complete reference      | Complete-pipeline routes                 | Full YAML bindings and downloads          | Retained |
| Troubleshooting         | Troubleshooting routes                   | Route ledger preservation                 | Retained |
| Related examples        | Overview cross-links                     | Related examples on all 26 overviews      | Retained |

No captain-approved feature removal was found in the compared history.
