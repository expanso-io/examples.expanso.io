# Machine tooling

The canonical command list is `package.json`. The commands below are grouped by the evidence they produce.

## Catalog and public projection

```bash
npm run test-catalog
npm run validate-catalog
npm run health-v2
npm run test-health-v2
```

The typed catalog drives discovery and the default sidebar. Health V2 is dimensional and fail-closed; unknown evidence never becomes a green percentage.

## Content, claims, and fixtures

```bash
npm run validate-content
npm run validate-claims
npm run content:estate-report
npm run test-content-foundation
npm run test-pipelines
```

Fixture generators live in `scripts/fixtures/`. Run a generator without `--write` to detect drift; use `--write` only to regenerate its declared files.

The remove-PII fixture comparison ignores only the recorded execution version.
Hashes, salts, inputs, expected outputs, and all other fixture fields must match.

## Example pipeline validation

```bash
npm run validate-examples
```

The harness uses the installed `expanso-edge` and `expanso-cli` releases on
`PATH`. Local validation does not query releases, download, pin, or cache binaries;
install the latest releases through the official Expanso installers first.
It inventories pipeline YAML under `examples/`, `static/files/`,
`static/pipelines/`, `docs/**/*.{yaml,yml}`, and catalog pipeline paths,
plus YAML and Bloblang code blocks in non-draft MDX pages, including indented
fences. Pipeline content in other fence languages fails with its file and line.
Documents with both input and output are complete pipelines; supported fragments
are validated in canonical context where available, or with minimal wrappers,
but never executed by the inventory harness. Bloblang declaration fragments
replace matching declarations in the canonical mapping; unmatched declarations
or unconsumed non-comment content fail validation. Kubernetes manifests
are excluded from validation reports, as are recognized Docker Compose and
Prometheus configurations. Unclassified YAML code blocks fail validation with
their page path and source line. Rendered pipeline blocks show a Complete pipeline
or Partial snippet badge from the shared classifier in `src/lib/pipelineCode.ts`.

Complete pipelines are validated with their original inputs and resources before
fixture substitution. An isolated local agent then runs deterministic inputs and
checks per-destination output contracts. The fixture manifest declares environment
values and stand-ins; reports list substituted inputs, outputs, paths, buffers,
and processors. A fixture pass does not establish connectivity to external
services, ingestion authentication, or a production operating envelope.

Each finished run writes Markdown and JSON under
`validation-reports/YYYY-MM-DD/` and mirrors that run in `validation-reports/latest/`.
The date defaults to UTC; `--date YYYY-MM-DD` selects a report folder. Reusing a
date replaces its report. Executor failures also produce failure reports.
The [report index](../validation-reports/README.md) is generated; do not edit
reports by hand.

The command fails for invalid or unclassified inventory YAML, failed pipeline
or fragment validation, skipped complete pipelines, failed execution, or failed
output assertions.
The workflow in `.github/workflows/validate-examples.yml` reruns the committed
report date and rejects report drift. The comparison ignores the run date and
recorded Edge and CLI versions; generated reports retain those values. Validation
results and all other report content must match. Regenerate and commit reports
after source changes before that CI check. It runs on every pull request and main push;
only changes entirely covered by its explicit inert-file list take a fast no-op.

The nightly workflow installs the latest Edge and CLI releases and validates
and runs the inventory without writing reports. Installation or validation
failures open or update one `edge-latest-drift` issue; a green run closes it.
There is no pinned-release lane or automatic pin bump. Production URL checks
run separately in `.github/workflows/live-pipeline-links.yml` on main and nightly,
so production availability does not block local or pull-request report generation.

`npm run test-pipelines` remains the narrower catalog offline-runnable gate;
it does not replace the complete-pipeline inventory check.

## Explorer drafts

```bash
npm run create-explorer -- \
  --name disconnected-edge \
  --category data-routing \
  --stages 4 \
  --title "Disconnected Edge"
```

The command creates:

- a draft Overview, Explorer, and Reference;
- an Explorer V2 stage module;
- a draft canonical pipeline.

It refuses overwrites, leaves the routes unpublished, and does not edit `sidebars.ts`. A machine must add the catalog record, topology, deterministic fixture, expected output/checkpoints, dataset evidence, Explorer provenance, fidelity oracle, and validation evidence before removing `draft: true`.

## Quality contracts

```bash
npm run quality:contracts
npm run test-performance-harness
npm run test-machine-journey-reducer
npm run test-quality-reducers
```

The performance, accessibility, and machine-journey contracts bind schemas, harness code, subject SHA, raw evidence, environment, and freshness. Missing browser evidence is `UNKNOWN` or `BLOCKED_CAPABILITY`, never PASS.

## Canonical Explorer stage ownership

```bash
npm run validate-stages
npm run test-stage-configs
```

Explorer configuration lives under `examples/explorer-stages/` and is bound by `content/explorer-stage-bindings-v1.json`. Stage modules own presentation data only. After an intentional canonical YAML or manifest edit, run `npm run stages:canonical:write` to regenerate the browser map, then rerun both read-only gates above. `validate-stages` also checks the deterministic fixture generator for drift. Use `npm run fixtures:explorer-stages -- --write` only when intentionally regenerating its declared sample inputs.

The checkpoint capture helpers in `scripts/fixtures/` require `benthos` on `PATH` and execute local fixture pipelines. `capture-explorer-checkpoints.mjs` checks sequential DB2, GDPR, backup, and retail checkpoints; `capture-medical-device-checkpoint.mjs` checks the complete error-events collection checkpoint. Run either with `node` and add `--write` to update its authored stage modules, then regenerate the browser map with the command above. These captures do not verify external database, custom-analysis, Parquet encoding, or destination integrations.

## Legacy structural tools

```bash
npm run validate-yaml
npm run validate-complete-yaml
npm run validate-cli
npm run check-health
npm run coverage-report
```

`check-health` and `coverage-report` inventory legacy file sets. They are observational compatibility tools; they do not establish catalog completeness, execution, operational evidence, claims validity, or release readiness.

## Crawlable navigation

`npm run build` validates that every sitemap page is reachable from the homepage through server-rendered anchors. Run `npm run test-static-navigation` to inspect an existing production build. Family guide links are generated from published Docusaurus documents; draft and unlisted pages are excluded.
