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
npm run stages:canonical
npm run test-stage-configs
```

Explorer configuration lives under `examples/explorer-stages/` and is bound by `content/explorer-stage-bindings-v1.json`. Stage modules own presentation data only. After an intentional canonical YAML or manifest edit, run `npm run stages:canonical:write` to regenerate the browser map, then rerun both read-only gates above.

## Legacy structural tools

```bash
npm run validate-yaml
npm run validate-complete-yaml
npm run validate-cli
npm run check-health
npm run coverage-report
```

`check-health` and `coverage-report` inventory legacy file sets. They are observational compatibility tools; they do not establish catalog completeness, execution, operational evidence, claims validity, or release readiness.
