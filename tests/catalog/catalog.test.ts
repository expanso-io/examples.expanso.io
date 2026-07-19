import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { verifyRemovePiiExplorerFidelity } from '../../scripts/quality/remove-pii-fidelity';
import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import { getCatalogOverviewProjection } from '../../src/catalog/overviewProjection';
import { buildRemovePiiExplorerStages } from '../../src/catalog/removePiiFidelity';
import {
  EXPLORER_EVIDENCE_SCHEMA,
  EXPLORER_EVIDENCE_SCHEMA_DIGEST,
  LOCATION_FACETS,
  VERIFICATION_POLICY,
  VERIFICATION_POLICY_DIGEST,
} from '../../src/catalog/schema';
import { validatePublicCatalog } from '../../src/catalog/validate';
import { verifyExplorerProvenanceBindings } from '../../scripts/quality/verify-explorer-provenance';
import {
  catalogFixture,
  withFirstFlow,
  withFirstNode,
  withFirstRecord,
  withRecord,
} from './fixtures';

function expectFailure(fixture: unknown, messageFragment: string) {
  const result = validatePublicCatalog(fixture);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes(messageFragment)),
    `expected an error containing ${JSON.stringify(messageFragment)}; received:\n${result.errors.join('\n')}`
  );
}

const repositoryRoot = process.cwd();
const removePiiCanonical = readFileSync(
  join(repositoryRoot, 'examples/data-security/remove-pii-complete.yaml'),
  'utf8'
);
const removePiiFixture = readFileSync(
  join(repositoryRoot, 'examples/data-security/remove-pii/sample-data.json'),
  'utf8'
);
const removePiiFixtureEnvironment = readFileSync(
  join(
    repositoryRoot,
    'examples/data-security/remove-pii/fixture-environment.json'
  ),
  'utf8'
);
const removePiiExpectedOutput = readFileSync(
  join(
    repositoryRoot,
    'examples/data-security/remove-pii/expected-output.jsonl'
  ),
  'utf8'
);
const removePiiStageModule = readFileSync(
  join(repositoryRoot, 'docs/data-security/remove-pii-full.stages.ts'),
  'utf8'
);

function verifyRemovePii(
  overrides: Partial<Parameters<typeof verifyRemovePiiExplorerFidelity>[0]> = {}
) {
  return verifyRemovePiiExplorerFidelity({
    canonicalPipelineYaml: removePiiCanonical,
    fixtureJson: removePiiFixture,
    fixtureEnvironmentJson: removePiiFixtureEnvironment,
    expectedOutputJsonl: removePiiExpectedOutput,
    stageModuleSource: removePiiStageModule,
    ...overrides,
  });
}

function swapProcessorTwoAndThree(yaml: string): string {
  const stepTwo = yaml.indexOf('      # Step 2:');
  const stepThree = yaml.indexOf('      # Step 3:');
  const stepFour = yaml.indexOf('      # Step 4:');
  assert.ok(stepTwo > -1 && stepTwo < stepThree && stepThree < stepFour);
  return `${yaml.slice(0, stepTwo)}${yaml.slice(stepThree, stepFour)}${yaml.slice(stepTwo, stepThree)}${yaml.slice(stepFour)}`;
}

describe('public catalog schema', () => {
  it('accepts the canonical 26-family registry', () => {
    const result = validatePublicCatalog(PUBLIC_CATALOG);
    assert.deepEqual(result, { valid: true, errors: [] });
    assert.equal(PUBLIC_CATALOG.records.length, 26);
  });

  it('binds explicit fail-closed provenance for every published Explorer', () => {
    const explorerRecords = PUBLIC_CATALOG.records.filter(
      (record) => record.routes.explore !== undefined
    );
    assert.equal(explorerRecords.length, 21);
    assert.ok(explorerRecords.every((record) => record.explorerEvidence));
    assert.deepEqual(verifyExplorerProvenanceBindings(), {
      schemaDigest: EXPLORER_EVIDENCE_SCHEMA_DIGEST,
      explorersVerified: 21,
      architectureBindingsVerified: 20,
      strengthenedFidelityBindingsVerified: 1,
      stagesVerified: 100,
      status: 'PASS',
    });
  });

  it('projects every overview header and system boundary from the exact catalog record', () => {
    const locationLabels = new Map(
      LOCATION_FACETS.map((location) => [location.id, location.label])
    );

    for (const record of PUBLIC_CATALOG.records) {
      const projection = getCatalogOverviewProjection(record.id);
      assert.deepEqual(projection.header, {
        title: record.title,
        outcome: record.oneLineOutcome,
        difficulty: record.difficulty,
        executionStatus: record.executionStatus,
        operationalEvidence: record.operationalEvidence,
        expectedTime: {
          inspectMinutes: record.expectedTime.inspectMinutes,
          ...(record.expectedTime.runMinutes === undefined
            ? {}
            : { runMinutes: record.expectedTime.runMinutes }),
        },
        verifiedAt: record.lastTechnicalVerification,
      });
      assert.deepEqual(projection.boundary, {
        nodes: record.topology.nodes.map(({ id, kind, label, location }) => ({
          id,
          kind,
          label,
          location: locationLabels.get(location) ?? location,
        })),
        flows: record.topology.flows.map(
          ({ crossesBoundary, from, payload, to }) => ({
            crossesBoundary,
            from,
            payload,
            to,
          })
        ),
      });

      const overviewRoot = join(
        repositoryRoot,
        'docs',
        record.routes.overview.replace(/^\//, '')
      );
      const overviewPath = join(overviewRoot, 'index.mdx');
      const source = readFileSync(overviewPath, 'utf8');
      const headerTags = source.match(/<ExampleHeader\b[\s\S]*?\/>/g) ?? [];
      const boundaryTags = source.match(/<SystemBoundary\b[\s\S]*?\/>/g) ?? [];
      assert.equal(
        headerTags.length,
        1,
        `${record.id} must render one ExampleHeader`
      );
      assert.equal(
        boundaryTags.length,
        1,
        `${record.id} must render one SystemBoundary`
      );
      assert.match(
        headerTags[0],
        new RegExp(`\\bexampleId=["']${record.id}["']`),
        `${record.id} header must bind its catalog record`
      );
      assert.match(
        boundaryTags[0],
        new RegExp(`\\bexampleId=["']${record.id}["']`),
        `${record.id} boundary must bind its catalog record`
      );
      assert.doesNotMatch(boundaryTags[0], /\b(?:nodes|flows)=/);
      assert.equal(
        existsSync(join(overviewRoot, 'boundary.ts')),
        false,
        `${record.id} must not own a duplicate boundary.ts`
      );
    }
  });

  it('pins the verification policy digest to its canonical JSON', () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(VERIFICATION_POLICY))
      .digest('hex');
    assert.equal(VERIFICATION_POLICY_DIGEST, `sha256:${digest}`);
  });

  it('pins the Explorer evidence schema digest to its canonical JSON', () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(EXPLORER_EVIDENCE_SCHEMA))
      .digest('hex');
    assert.equal(EXPLORER_EVIDENCE_SCHEMA_DIGEST, `sha256:${digest}`);
  });

  it('rejects unknown record fields', () => {
    expectFailure(
      withFirstRecord((record) => {
        record.privateEvidencePath = '/Us' + 'ers/example/private.md';
      }),
      'privateEvidencePath: unknown field'
    );
  });

  it('rejects unknown facet ids', () => {
    expectFailure(
      withFirstRecord((record) => {
        record.goals = ['not-a-goal'];
      }),
      'unknown value "not-a-goal"'
    );
  });

  it('rejects unknown topology components', () => {
    expectFailure(
      withFirstNode((node) => {
        node.componentId = 'mystery-service';
      }),
      'unknown value "mystery-service"'
    );
  });

  it('requires normalized components on topology sources and destinations', () => {
    expectFailure(
      withFirstNode((node) => {
        delete node.componentId;
      }),
      'required for a source or destination facet'
    );
  });

  it('rejects flows whose endpoints are absent', () => {
    expectFailure(
      withFirstFlow((flow) => {
        flow.to = 'missing-node';
      }),
      'unknown node "missing-node"'
    );
  });

  it('rejects a producer that verifies its own record', () => {
    expectFailure(
      withFirstRecord((record) => {
        record.verifierLane = record.producerLane;
      }),
      'must be independent from producerLane'
    );
  });

  it('rejects duplicate record ids', () => {
    const fixture = catalogFixture() as { records: Record<string, unknown>[] };
    fixture.records[1].id = fixture.records[0].id;
    expectFailure(fixture, 'duplicate id');
  });

  it('rejects evidence labels without governed claim ids', () => {
    expectFailure(
      withFirstRecord((record) => {
        record.operationalEvidence = 'component-tested';
        record.claimIds = [];
      }),
      'tested evidence requires a governed claim id'
    );
  });

  it('rejects an evidence-free upgrade to offline-runnable', () => {
    expectFailure(
      withRecord('enforce-schema', (record) => {
        record.executionStatus = 'offline-runnable';
        delete record.fixturePath;
      }),
      'required as deterministic execution evidence for an offline-runnable record'
    );
  });

  it('requires a complete pipeline for offline-runnable status', () => {
    expectFailure(
      withRecord('enforce-schema', (record) => {
        record.executionStatus = 'offline-runnable';
        delete record.completePipelinePath;
      }),
      'required as execution evidence for an offline-runnable record'
    );
  });

  it('requires a complete pipeline for every published Explorer', () => {
    expectFailure(
      withRecord('circuit-breakers', (record) => {
        delete record.completePipelinePath;
      }),
      'required for a published Explorer'
    );
  });

  it('rejects missing provenance even for an architecture-only Explorer', () => {
    expectFailure(
      withRecord('circuit-breakers', (record) => {
        delete record.explorerEvidence;
      }),
      'explorerEvidence: required for every published Explorer'
    );
  });

  it('requires an Explorer route when Explorer evidence is bound', () => {
    expectFailure(
      withRecord('remove-pii', (record) => {
        const routes = record.routes as Record<string, unknown>;
        delete routes.explore;
      }),
      'required when Explorer evidence is bound'
    );
  });

  it('requires an asserted expected output for offline-runnable status', () => {
    expectFailure(
      withRecord('enforce-schema', (record) => {
        record.executionStatus = 'offline-runnable';
        delete record.expectedOutputPath;
      }),
      'required as asserted output evidence for an offline-runnable record'
    );
  });

  it('accepts an evidenced offline-runnable status without conflating operational evidence', () => {
    const fixture = withRecord('remove-pii', (record) => {
      record.executionStatus = 'offline-runnable';
      const expectedTime = record.expectedTime as Record<string, unknown>;
      expectedTime.runMinutes = 5;
      const routes = record.routes as Record<string, unknown>;
      routes.run = '/data-security/remove-pii/setup/';
      record.expectedOutputPath =
        'examples/data-security/remove-pii/expected-output.json';
      const explorerEvidence = record.explorerEvidence as Record<
        string,
        unknown
      >;
      explorerEvidence.executionStatus = 'offline-runnable';
    });
    assert.deepEqual(validatePublicCatalog(fixture), {
      valid: true,
      errors: [],
    });
  });

  it('rejects requires-integration without maintained-environment evidence', () => {
    expectFailure(
      withRecord('remove-pii', (record) => {
        record.executionStatus = 'requires-integration';
      }),
      'requires-integration needs a bound maintained-environment result'
    );
  });

  it('rejects a run route on architecture-only records', () => {
    expectFailure(
      withRecord('enforce-schema', (record) => {
        const routes = record.routes as Record<string, unknown>;
        routes.run = '/data-security/enforce-schema/setup/';
      }),
      'architecture-only records cannot advertise a run route'
    );
  });

  it('rejects a run time on architecture-only records', () => {
    expectFailure(
      withRecord('enforce-schema', (record) => {
        const expectedTime = record.expectedTime as Record<string, unknown>;
        expectedTime.runMinutes = 5;
      }),
      'architecture-only records cannot advertise a run time'
    );
  });

  it('rejects beginner difficulty without an offline-runnable core path', () => {
    expectFailure(
      withRecord('enforce-schema', (record) => {
        record.difficulty = 'beginner';
      }),
      'beginner requires a verified offline-runnable core path'
    );
  });

  it('rejects private absolute repository paths', () => {
    expectFailure(
      withFirstRecord((record) => {
        record.fixturePath = '/Us' + 'ers/example/private.json';
      }),
      'expected a repository-relative public path'
    );
  });

  it('rejects malformed Explorer artifact digests', () => {
    expectFailure(
      withRecord('remove-pii', (record) => {
        const evidence = record.explorerEvidence as Record<string, unknown>;
        evidence.pipelineSha256 = 'sha256:not-a-real-digest';
      }),
      'pipelineSha256: expected a lowercase SHA-256 digest'
    );
  });

  it('rejects executed Explorer provenance for architecture-only records', () => {
    expectFailure(
      withRecord('remove-pii', (record) => {
        record.executionStatus = 'architecture-only';
        const routes = record.routes as Record<string, unknown>;
        delete routes.run;
        const expectedTime = record.expectedTime as Record<string, unknown>;
        delete expectedTime.runMinutes;
        const evidence = record.explorerEvidence as Record<string, unknown>;
        evidence.executionStatus = 'architecture-only';
        evidence.kind = 'executed-pipeline';
      }),
      'architecture-only records require curated-explanation provenance'
    );
  });

  it('rejects self-verified Explorer evidence', () => {
    expectFailure(
      withRecord('remove-pii', (record) => {
        const evidence = record.explorerEvidence as Record<string, unknown>;
        evidence.verifierLane = record.producerLane;
      }),
      'explorerEvidence.verifierLane: must be independent from producerLane'
    );
  });
});

describe('Remove PII Explorer fidelity', () => {
  it('independently verifies canonical processors, checkpoints, fixture bindings, and environment values', () => {
    assert.deepEqual(verifyRemovePii(), {
      contractId: 'remove-pii-explorer-fidelity-v1',
      processorsVerified: 5,
      checkpointsVerified: 6,
      stageInputsVerified: 6,
      stageOutputsVerified: 6,
      fixtureBindingsVerified: 3,
      environmentValuesVerified: 3,
      status: 'PASS',
    });
  });

  it('rejects a processor-order mutation', () => {
    assert.throws(
      () =>
        verifyRemovePii({
          canonicalPipelineYaml: swapProcessorTwoAndThree(removePiiCanonical),
        }),
      /processor 2/
    );
  });

  it('rejects a salt-bypassing plain SHA-256 mutation', () => {
    assert.throws(
      () =>
        verifyRemovePii({
          canonicalPipelineYaml: removePiiCanonical.replace(
            '"hmac_sha256"',
            '"sha256"'
          ),
        }),
      /processor 2/
    );
  });

  it('rejects a changed fixture source that is not bound to the fixed outputs', () => {
    assert.throws(
      () =>
        verifyRemovePii({
          fixtureJson: removePiiFixture.replace(
            '192.168.1.100',
            '192.168.1.101'
          ),
        }),
      /input digest/
    );
  });

  it('rejects a fixture-environment salt that does not produce expected output', () => {
    assert.throws(
      () =>
        verifyRemovePii({
          fixtureEnvironmentJson: removePiiFixtureEnvironment.replace(
            'remove-pii-fixture-ip-salt-v1',
            'wrong-ip-salt'
          ),
        }),
      /fixture expected output/
    );
  });

  it('rejects a tampered displayed checkpoint', () => {
    const stages = structuredClone(
      buildRemovePiiExplorerStages(
        removePiiCanonical,
        removePiiFixture,
        removePiiFixtureEnvironment,
        removePiiExpectedOutput
      )
    );
    const hashLine = stages[2].outputLines.find((line) =>
      line.content.includes('"ip_hash"')
    );
    assert.ok(hashLine);
    hashLine.content = hashLine.content.replace(/[0-9a-f]{64}/, '0'.repeat(64));
    assert.throws(() => verifyRemovePii({ stages }), /stage 3 output/);
  });

  it('rejects stage-module code that can alter generated checkpoints', () => {
    assert.throws(
      () =>
        verifyRemovePii({
          stageModuleSource: `${removePiiStageModule}\nremovePiiFullStages.pop();\n`,
        }),
      /may not transform generated stage data/
    );
  });
});
