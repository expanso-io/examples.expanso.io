import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  validateClaimsEvidence,
  digestFixtureSet,
} from './content-validation/claims';
import { validateContent } from './content-validation/content';
import { sha256, sha256File } from './content-validation/io';

const root = process.cwd();
const contentPolicyPath = resolve(
  root,
  'content/contracts/content-policy-v1.json'
);
const claimsPolicyPath = resolve(
  root,
  'content/contracts/claims-policy-v1.json'
);
const datasetPolicyPath = resolve(
  root,
  'content/contracts/dataset-policy-v1.json'
);
const fixedNow = new Date('2026-07-18T12:00:00.000Z');

async function main(): Promise<void> {
  const validContent = await validateContent({
    repositoryRoot: root,
    inputRoot: resolve(root, 'tests/content-validation/fixtures/valid'),
    policyPath: contentPolicyPath,
    now: fixedNow,
  });
  assert.equal(
    validContent.status,
    'PASS',
    JSON.stringify(validContent.errors)
  );

  const duplicateTitleRoot = await mkdtemp(
    join(tmpdir(), 'examples-content-title-contract-')
  );
  const duplicateTitlePath = resolve(duplicateTitleRoot, 'overview.mdx');
  const validOverview = await readFile(
    resolve(root, 'tests/content-validation/fixtures/valid/overview.mdx'),
    'utf8'
  );
  await writeFile(
    duplicateTitlePath,
    validOverview.replace(
      '# Validate an example',
      '<ExampleHeader title="Validate an example" outcome="Inspect the example." />\n\n# Validate an example'
    )
  );
  const duplicateTitle = await validateContent({
    repositoryRoot: root,
    inputRoot: duplicateTitlePath,
    policyPath: contentPolicyPath,
    now: fixedNow,
  });
  assert.equal(duplicateTitle.status, 'FAIL');
  assert.ok(
    duplicateTitle.errors.some(
      (finding) =>
        finding.code === 'STRUCTURE_INVALID' &&
        finding.message.includes('must set hide_title: true')
    ),
    JSON.stringify(duplicateTitle.errors)
  );

  await expectContentFailure('budget.mdx', 'BUDGET_EXCEEDED');
  await expectContentFailure('dynamic-text.mdx', 'DYNAMIC_VISIBLE_CONTENT');
  await expectContentFailure(
    'unknown-component.mdx',
    'UNKNOWN_CONTENT_COMPONENT'
  );
  await expectContentFailure('coming-soon.mdx', 'PLACEHOLDER_CONTENT');
  await expectContentFailure(
    'readiness-wording.mdx',
    'READINESS_VOCABULARY_INVALID'
  );
  await expectContentFailure(
    'readiness-value.mdx',
    'READINESS_VOCABULARY_INVALID'
  );
  await expectContentFailure('overview-structure.mdx', 'STRUCTURE_INVALID');

  const testRepository = await makeClaimsRepository();
  const common = {
    repositoryRoot: testRepository,
    inputRoot: resolve(testRepository, 'docs'),
    contentPolicyPath,
    claimsPolicyPath,
    datasetPolicyPath,
    claimRegistryPath: resolve(testRepository, 'claims.json'),
    datasetRegistryPath: resolve(testRepository, 'datasets.json'),
    catalogRecords: [
      {
        id: 'example',
        claimIds: ['public-boundary'],
        fixturePath: 'examples/example/input.json',
        lastTechnicalVerification: '2026-07-18',
        lastEditorialVerification: '2026-07-18',
      },
    ],
    today: '2026-07-18',
    now: fixedNow,
  };
  const validClaims = await validateClaimsEvidence(common);
  assert.equal(validClaims.status, 'PASS', JSON.stringify(validClaims.errors));

  const validClaimRegistry = JSON.parse(
    await readFile(common.claimRegistryPath, 'utf8')
  ) as { claims: Array<Record<string, unknown>> };
  validClaimRegistry.claims[0].reviewBy = '2026-07-17';
  await writeFile(
    common.claimRegistryPath,
    `${JSON.stringify(validClaimRegistry, null, 2)}\n`
  );
  const expired = await validateClaimsEvidence(common);
  assert.equal(expired.status, 'FAIL');
  assert.ok(expired.errors.some((finding) => finding.code === 'CLAIM_EXPIRED'));

  validClaimRegistry.claims[0].reviewBy = '2027-01-01';
  validClaimRegistry.claims[0].verifiedAt = '2026-07-19';
  await writeFile(
    common.claimRegistryPath,
    `${JSON.stringify(validClaimRegistry, null, 2)}\n`
  );
  const futureClaim = await validateClaimsEvidence(common);
  assert.equal(futureClaim.status, 'FAIL');
  assert.ok(
    futureClaim.errors.some(
      (finding) => finding.code === 'CLAIM_EVIDENCE_INVALID'
    )
  );

  validClaimRegistry.claims[0].verifiedAt = '2026-07-18';
  const publicSource = validClaimRegistry.claims[0].publicSource as Record<
    string,
    unknown
  >;
  publicSource.opaqueEvidence = true;
  await writeFile(
    common.claimRegistryPath,
    `${JSON.stringify(validClaimRegistry, null, 2)}\n`
  );
  const nestedUnknown = await validateClaimsEvidence(common);
  assert.equal(nestedUnknown.status, 'FAIL');
  assert.ok(
    nestedUnknown.errors.some((finding) =>
      finding.message.includes('Unknown field: opaqueEvidence')
    )
  );
  delete publicSource.opaqueEvidence;
  await writeFile(
    common.claimRegistryPath,
    `${JSON.stringify(validClaimRegistry, null, 2)}\n`
  );
  const validDatasetRegistry = JSON.parse(
    await readFile(common.datasetRegistryPath, 'utf8')
  ) as { datasets: Array<Record<string, unknown>> };
  const piiScan = validDatasetRegistry.datasets[0].piiScan as Record<
    string,
    unknown
  >;
  piiScan.opaqueEvidence = true;
  await writeFile(
    common.datasetRegistryPath,
    `${JSON.stringify(validDatasetRegistry, null, 2)}\n`
  );
  const datasetNestedUnknown = await validateClaimsEvidence(common);
  assert.equal(datasetNestedUnknown.status, 'FAIL');
  assert.ok(
    datasetNestedUnknown.errors.some((finding) =>
      finding.message.includes('Unknown field: opaqueEvidence')
    )
  );
  delete piiScan.opaqueEvidence;
  piiScan.checkedAt = '2026-07-19';
  await writeFile(
    common.datasetRegistryPath,
    `${JSON.stringify(validDatasetRegistry, null, 2)}\n`
  );
  const futureDatasetScan = await validateClaimsEvidence(common);
  assert.equal(futureDatasetScan.status, 'FAIL');
  assert.ok(
    futureDatasetScan.errors.some(
      (finding) => finding.code === 'DATASET_EVIDENCE_INVALID'
    )
  );
  piiScan.checkedAt = '2026-07-18';
  await writeFile(
    common.datasetRegistryPath,
    `${JSON.stringify(validDatasetRegistry, null, 2)}\n`
  );
  const routePath = resolve(testRepository, 'docs/example/index.mdx');
  const validRoute = await readFile(routePath, 'utf8');
  const materialHeadingFixture = await readFile(
    resolve(
      root,
      'tests/content-validation/fixtures/invalid/material-claim-heading.mdx'
    ),
    'utf8'
  );
  const materialHeading = materialHeadingFixture.match(/^# .+$/m)?.[0];
  assert.equal(materialHeading, '# Guaranteed 80% cost reduction');
  await writeFile(
    routePath,
    validRoute.replace('# Evidence example', materialHeading)
  );
  const headingClaim = await validateClaimsEvidence(common);
  assert.equal(headingClaim.status, 'FAIL');
  assert.ok(
    headingClaim.errors.some((finding) => finding.code === 'CLAIM_UNMAPPED'),
    JSON.stringify(headingClaim.errors)
  );

  await writeFile(routePath, validRoute);
  const stageManifestPath = resolve(testRepository, 'docs/example/stages.ts');
  const validStageManifest = await readFile(stageManifestPath, 'utf8');
  await writeFile(
    stageManifestPath,
    validStageManifest.replace(
      'Inspect one deterministic stage.',
      'Guaranteed 80% cost reduction'
    )
  );
  const importedClaim = await validateClaimsEvidence(common);
  assert.equal(importedClaim.status, 'FAIL');
  assert.ok(
    importedClaim.errors.some((finding) => finding.code === 'CLAIM_UNMAPPED'),
    JSON.stringify(importedClaim.errors)
  );
  await writeFile(stageManifestPath, validStageManifest);

  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      'title: Evidence example',
      'title: Evidence example\ndescription: PCI-DSS compliant processing'
    ),
    'frontmatter compliance claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      '```yaml\n# PCI-DSS compliant processing\npipeline: {}\n```\n\n## Pipeline'
    ),
    'fenced code-comment compliance claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      '| Storage class | Cost/GB/month |\n| --- | --- |\n| Archive | $0.0012 |\n\n## Pipeline'
    ),
    'storage-pricing table claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      '| Format | Compression ratio | Query latency |\n| --- | --- | --- |\n| Parquet | 90% | 2 seconds |\n\n## Pipeline'
    ),
    'compression and query table claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      '```yaml\nidempotent: true # Exactly-once semantics\n```\n\n## Pipeline'
    ),
    'exactly-once code-comment claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'The scheduler guarantees delivery.\n\n## Pipeline'
    ),
    'guaranteed-delivery claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'Age scoring is guaranteeing delivery.\n\n## Pipeline'
    ),
    'guaranteeing-delivery claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This is a secure and robust input configuration.\n\n## Pipeline'
    ),
    'generic secure and robust claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This is a production-grade analytics pipeline.\n\n## Pipeline'
    ),
    'production-grade claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'The mapping language is more expressive and testable.\n\n## Pipeline'
    ),
    'comparative expressive claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      '## Pipeline Configuration (Better!)\n\n## Pipeline'
    ),
    'better comparative heading'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This configuration has all the power of the incumbent.\n\n## Pipeline'
    ),
    'all-the-power comparative claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This provides seamless integration with the destination.\n\n## Pipeline'
    ),
    'seamless integration claim'
  );
  await expectRouteClaimFailure(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This is an efficient storage workflow.\n\n## Pipeline'
    ),
    'unqualified efficiency claim'
  );
  for (const [claim, label] of [
    ['Zero data loss during outages.', 'zero-data-loss claim'],
    [
      'This simulates 43 million transactions per day, a realistic volume for a mid-size chain.',
      'realistic numeric-scale claim',
    ],
    [
      'DEBUG logs consume 80% of storage while providing 1% of the value.',
      'percentage allocation claim',
    ],
  ] as const) {
    await expectRouteClaimFailure(
      common,
      routePath,
      validRoute.replace('## Pipeline', `${claim}\n\n## Pipeline`),
      label
    );
  }
  await expectRouteClaimPass(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This example does not assess exactly-once behavior.\n\n## Pipeline'
    ),
    'negative exactly-once context'
  );
  await expectRouteClaimPass(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'Priority ordering does not guarantee delivery.\n\n## Pipeline'
    ),
    'negative delivery-guarantee context'
  );
  await expectRouteClaimPass(
    common,
    routePath,
    validRoute.replace(
      '## Pipeline',
      'This configuration is not a secure or robust deployment baseline.\n\n## Pipeline'
    ),
    'negative secure and robust context'
  );

  await writeFile(
    routePath,
    validRoute.replace(
      'A dated public source describes the example boundary.',
      'Guaranteed savings make this the best platform.'
    )
  );
  const unmapped = await validateClaimsEvidence(common);
  assert.equal(unmapped.status, 'FAIL');
  assert.ok(
    unmapped.errors.some(
      (finding) =>
        finding.code === 'CLAIM_UNMAPPED' || finding.code === 'PROHIBITED_CLAIM'
    )
  );

  await writeFile(
    routePath,
    validRoute.replace(
      'Inspect the fixture',
      'Inspect /Us' + 'ers/private/customer ' + 'transcript fixture'
    )
  );
  const privateLeak = await validateClaimsEvidence(common);
  assert.equal(privateLeak.status, 'FAIL');
  assert.ok(
    privateLeak.errors.some(
      (finding) => finding.code === 'PRIVATE_EVIDENCE_LEAK'
    )
  );

  await writeFile(routePath, validRoute);
  const unregisteredCatalogFixture = await validateClaimsEvidence({
    ...common,
    catalogRecords: [
      {
        ...common.catalogRecords[0],
        fixturePath: 'examples/example/not-registered.json',
      },
    ],
  });
  assert.equal(unregisteredCatalogFixture.status, 'FAIL');
  assert.ok(
    unregisteredCatalogFixture.errors.some(
      (finding) => finding.code === 'DATASET_EVIDENCE_INVALID'
    )
  );

  process.stdout.write(
    `${JSON.stringify({ gateIds: ['content-validator-v1', 'claims-evidence-v1'], status: 'PASS', assertions: 35 })}\n`
  );
}

async function expectRouteClaimFailure(
  common: Parameters<typeof validateClaimsEvidence>[0],
  routePath: string,
  invalidRoute: string,
  label: string
): Promise<void> {
  await writeFile(routePath, invalidRoute);
  const result = await validateClaimsEvidence(common);
  assert.equal(result.status, 'FAIL', `${label}: ${JSON.stringify(result)}`);
  assert.ok(
    result.errors.some((finding) => finding.code === 'CLAIM_UNMAPPED'),
    `${label}: ${JSON.stringify(result.errors)}`
  );
}

async function expectRouteClaimPass(
  common: Parameters<typeof validateClaimsEvidence>[0],
  routePath: string,
  route: string,
  label: string
): Promise<void> {
  await writeFile(routePath, route);
  const result = await validateClaimsEvidence(common);
  assert.equal(result.status, 'PASS', `${label}: ${JSON.stringify(result)}`);
}

async function expectContentFailure(file: string, code: string): Promise<void> {
  const result = await validateContent({
    repositoryRoot: root,
    inputRoot: resolve(root, 'tests/content-validation/fixtures/invalid', file),
    policyPath: contentPolicyPath,
    now: fixedNow,
  });
  assert.equal(result.status, 'FAIL');
  assert.ok(
    result.errors.some((finding) => finding.code === code),
    JSON.stringify(result.errors)
  );
}

async function makeClaimsRepository(): Promise<string> {
  const repository = await mkdtemp(
    join(tmpdir(), 'examples-content-contract-')
  );
  await mkdir(resolve(repository, 'docs/example'), { recursive: true });
  await mkdir(resolve(repository, 'examples/example'), { recursive: true });
  await mkdir(resolve(repository, 'generators'), { recursive: true });
  await writeFile(
    resolve(repository, 'examples/example/input.json'),
    '{"value":1}\n'
  );
  await writeFile(
    resolve(repository, 'generators/make-fixture.js'),
    'process.stdout.write("{\\\"value\\\":1}\\n");\n'
  );
  await writeFile(
    resolve(repository, 'docs/example/stages.ts'),
    `export const evidenceStages = [
  {
    id: 1,
    title: 'Fixture inspection',
    description: 'Inspect one deterministic stage.',
    inputLines: [{ content: 'synthetic input' }],
    outputLines: [{ content: 'documented output' }],
  },
];
`
  );
  const claimsPolicyDigest = sha256(await readFile(claimsPolicyPath));
  const datasetPolicyDigest = sha256(await readFile(datasetPolicyPath));
  const fixtureDigest = await digestFixtureSet(repository, [
    'examples/example/input.json',
  ]);
  assert.ok(fixtureDigest);
  const generatorDigest = await sha256File(
    resolve(repository, 'generators/make-fixture.js')
  );
  const route = `---
title: Evidence example
contentArchetype: overview
executionStatus: architecture-only
operationalEvidence: not-assessed
difficulty: intermediate
verificationDate: '2026-07-18'
expectedTime: 5 minutes to inspect
claimIds: [public-boundary]
claimsVerifiedBy: verifier-agent
claimsVerifiedAt: '2026-07-18'
claimsPolicyDigest: ${claimsPolicyDigest}
---

import DataPipelineExplorer from '@site/src/components/DataPipelineExplorer';
import { evidenceStages } from './stages';

# Evidence example

Inspect the fixture and its declared system boundary. A dated public source describes the example boundary.

## Get started

Run the deterministic fixture and compare its output with the asserted record.

<DataPipelineExplorer stages={evidenceStages} title="Evidence" subtitle="Static manifest" />

## Pipeline

Read the fixture, inspect its declared boundary, and compare the documented result.

## Limitations and assumptions

This contract does not claim maintained-environment runtime execution.

## Related examples

Use the catalog to find another evidence-governed example.
`;
  await writeFile(resolve(repository, 'docs/example/index.mdx'), route);
  await writeFile(
    resolve(repository, 'claims.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0.0',
        policyVersion: 'claims-evidence-v1',
        policyDigest: claimsPolicyDigest,
        claims: [
          {
            id: 'public-boundary',
            exactWording:
              'A dated public source describes the example boundary.',
            conservativeVariants: [
              'The public source describes the example boundary.',
            ],
            type: 'interoperability',
            status: 'third-party-sourced',
            routes: ['/example'],
            assumptions: [
              'The cited version is the version discussed by the example.',
            ],
            environment: { component: 'example-v1' },
            producerAgentId: 'producer-agent',
            verifierAgentId: 'verifier-agent',
            verifiedAt: '2026-07-18',
            reviewBy: '2027-01-01',
            publicSource: {
              url: 'https://example.com/primary-source',
              title: 'Primary source',
              publicationDate: '2026-07-01',
              retrievedAt: '2026-07-18',
            },
          },
        ],
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    resolve(repository, 'datasets.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0.0',
        policyVersion: 'dataset-evidence-v1',
        policyDigest: datasetPolicyDigest,
        datasets: [
          {
            id: 'deterministic-input',
            kind: 'synthetic',
            fixturePaths: ['examples/example/input.json'],
            fixtureSha256: fixtureDigest,
            deterministic: true,
            attribution: 'Generated for this repository.',
            transformationRecord:
              'No transformation after deterministic generation.',
            redistributionScope: 'repository-and-public-build',
            dataRightsVerdict: 'allowed',
            piiScan: {
              tool: 'fixture-scan-v1',
              command: 'scan examples/example/input.json',
              result: 'PASS',
              checkedAt: '2026-07-18',
            },
            syntheticDataScan: {
              tool: 'fixture-scan-v1',
              command: 'classify examples/example/input.json',
              result: 'PASS',
              checkedAt: '2026-07-18',
            },
            generation: {
              command: 'node generators/make-fixture.js',
              generatorPath: 'generators/make-fixture.js',
              generatorSha256: generatorDigest,
              seed: 'fixed-v1',
            },
          },
        ],
      },
      null,
      2
    )}\n`
  );
  return repository;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
});
