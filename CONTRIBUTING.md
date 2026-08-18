# Machine contribution contract

This repository publishes examples only after executable gates prove the public route, configuration, fixture, claims, and interaction agree. File presence is not completion.

## Canonical records

Update these sources together:

- `src/catalog/registry.ts`: public discovery, topology, routes, and readiness.
- `content/datasets/datasets-v1.json`: rights, fixture set digest, and deterministic generator.
- `content/claims/claims-v1.json`: material public claims and evidence.
- `examples/**`: canonical pipeline and deterministic fixture files.
- `docs/**`: the public projection of those records.

The sidebar is generated from the catalog. Do not hand-add family trees to `sidebars.ts`.

## Readiness is two-dimensional

Use one execution status:

- `offline-runnable`: a checked-in fixture executes without credentials or network access and asserts expected output.
- `requires-integration`: a maintained test requires a named service, adapter, credential, hardware target, or network dependency.
- `architecture-only`: the boundary is reviewed but no maintained end-to-end execution result exists.

Use one independent operational-evidence status:

- `not-assessed`
- `component-tested`
- `operating-envelope-tested`

Never infer either status from prose. Never use `production-ready` as a substitute.

## Public page model

A family exposes at most four primary surfaces:

1. Overview: outcome, metadata, system boundary, action, limitations, related examples.
2. Explore: the verified transformation or deterministic runtime behavior.
3. Run locally: prerequisites, one command path, fixture, expected result, cleanup. This route is allowed only for `offline-runnable`.
4. Reference: canonical configuration, adaptations, failure modes, and troubleshooting.

Preserve an existing deep route until route-disposition and deployed redirect evidence permit retirement.

## System boundary

Every topology node is labeled `expanso-native`, `protocol-adapter`, `custom`, or `external`. Every flow names its payload, classification, and whether it crosses a boundary. A socket that receives decoded lines is not a native Modbus, OPC UA, DNP3, IEC 61850, or other protocol client.

## Explorer V2

Use Explorer V2 only when the interaction teaches a distinct task. It requires:

- a canonical pipeline and deterministic fixture;
- stable stage ids and semantic diffs;
- generated or independently verified checkpoints;
- fixture, pipeline, output, environment, and fidelity digests;
- accurate executed, deterministic-simulation, or curated-explanation provenance;
- URL, keyboard, responsive, copy, download, accessibility, and browser evidence.

`npm run create-explorer` creates an unpublished, fail-closed draft. It does not add the family to the sidebar or manufacture evidence.

## Claims and data

- Register every material legal, compliance, cost, performance, reliability, security, market, partner, interoperability, bandwidth, compression, or accuracy claim.
- Use synthetic fixtures by default. Register every file matched by the dataset policy and bind it to a deterministic generator.
- Do not commit customer data, private evidence handles, secrets, absolute workstation paths, or internal demand records.
- Hashing and pseudonymization are not anonymization. Architecture examples do not establish compliance or operating behavior.

## Required local gates

Run the gates relevant to the change, then the full foundation set:

```bash
npm run typecheck -- --noEmit
npm run test-catalog
npm run validate-catalog
npm run validate-content
npm run validate-claims
npm run test-pipelines
npm run quality:contracts
npm run test-performance-harness
npm run test-machine-journey-reducer
npm run build
git diff --check
```

Browser, accessibility, performance, exact-SHA artifact, deploy, redirect, and production-canary gates remain separate. A local pass never implies deployment or production acceptance.
