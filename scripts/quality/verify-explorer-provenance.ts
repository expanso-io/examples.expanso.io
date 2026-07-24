import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';

import { GENERATED_ARCHITECTURE_EXPLORER_EVIDENCE } from '../../src/catalog/explorerEvidence.generated';
import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../src/catalog/explorerStageConfigs.generated';
import { EXAMPLE_RECORDS } from '../../src/catalog/registry';
import {
  EXPLORER_EVIDENCE_SCHEMA_DIGEST,
  REMOVE_PII_EXPLORER_EVIDENCE,
  type ExplorerEvidence,
} from '../../src/catalog/schema';

const MANIFEST_PATH = 'content/explorer-stage-bindings-v1.json';
const GENERATOR_PATH = 'scripts/generate-explorer-stage-configs.ts';
const SEMANTICS_VERIFIER_PATH = 'scripts/quality/verify-explorer-provenance.ts';

type ManifestStage = {
  id: number;
  slug: string;
  title: string;
  configPath: string;
  configSha256: `sha256:${string}`;
};

type ManifestExplorer = {
  exampleId: string;
  sourceKind: 'canonical-fragment-files' | 'remove-pii-canonical-generator';
  stageModule: string;
  stageExport: string;
  canonicalPipelinePath: string;
  pipelineSha256: `sha256:${string}`;
  stages: ManifestStage[];
};

type Manifest = {
  schemaVersion: 'explorer-stage-bindings-v1';
  normalization: 'exact-utf8-final-newline-v1';
  explorers: ManifestExplorer[];
};

export interface ExplorerProvenanceVerification {
  schemaDigest: typeof EXPLORER_EVIDENCE_SCHEMA_DIGEST;
  explorersVerified: number;
  architectureBindingsVerified: number;
  strengthenedFidelityBindingsVerified: number;
  stagesVerified: number;
  status: 'PASS';
}

function sha256(bytes: string | Buffer): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function fileDigest(path: string): `sha256:${string}` {
  return sha256(readFileSync(resolve(path)));
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string
): ts.Expression | undefined {
  const candidate = object.properties.find(
    (entry): entry is ts.PropertyAssignment =>
      ts.isPropertyAssignment(entry) &&
      ((ts.isIdentifier(entry.name) && entry.name.text === name) ||
        (ts.isStringLiteral(entry.name) && entry.name.text === name))
  );
  return candidate?.initializer;
}

function literalString(value: ts.Expression | undefined): string | undefined {
  return value &&
    (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : undefined;
}

function literalNumber(value: ts.Expression | undefined): number | undefined {
  return value && ts.isNumericLiteral(value) ? Number(value.text) : undefined;
}

/**
 * Independently project authored stage identity with the TypeScript AST.
 *
 * The canonical generator executes transpiled modules. This verifier does not:
 * it reads only literal id/slug/title declarations, so the evidence lane fails
 * closed if executable module behavior and authored checkpoint identity drift.
 */
function verifyLiteralStageSemantics(binding: ManifestExplorer): void {
  const source = readFileSync(resolve(binding.stageModule), 'utf8');
  const sourceFile = ts.createSourceFile(
    binding.stageModule,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  let stageArray: ts.ArrayLiteralExpression | undefined;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === binding.stageExport &&
        declaration.initializer &&
        ts.isArrayLiteralExpression(declaration.initializer)
      ) {
        stageArray = declaration.initializer;
      }
    }
  });
  assert.ok(
    stageArray,
    `${binding.exampleId} does not expose literal stage array ${binding.stageExport}`
  );
  assert.equal(
    stageArray.elements.length,
    binding.stages.length,
    `${binding.exampleId} authored stage count drifted`
  );
  binding.stages.forEach((expected, index) => {
    const element = stageArray!.elements[index];
    assert.ok(
      ts.isObjectLiteralExpression(element),
      `${binding.exampleId} stage ${index + 1} is not an object literal`
    );
    assert.equal(
      literalNumber(property(element, 'id')),
      expected.id,
      `${binding.exampleId} stage ${index + 1} id drifted`
    );
    assert.equal(
      literalString(property(element, 'slug')),
      expected.slug,
      `${binding.exampleId} stage ${index + 1} slug drifted`
    );
    assert.equal(
      literalString(property(element, 'title')),
      expected.title,
      `${binding.exampleId} stage ${index + 1} title drifted`
    );
  });
}

function expectedArchitectureEvidence(
  record: (typeof EXAMPLE_RECORDS)[number],
  binding: ManifestExplorer,
  manifestSha256: `sha256:${string}`
): ExplorerEvidence {
  const firstStage = binding.stages.at(0);
  const lastStage = binding.stages.at(-1);
  assert.ok(firstStage, `${binding.exampleId} has no input checkpoint`);
  assert.ok(lastStage, `${binding.exampleId} has no output checkpoint`);
  return {
    exampleId: record.id,
    kind: 'curated-explanation',
    verificationId: `${record.id}-curated-stage-binding-v1`,
    schemaDigest: EXPLORER_EVIDENCE_SCHEMA_DIGEST,
    canonicalPipelinePath: binding.canonicalPipelinePath,
    pipelineSha256: binding.pipelineSha256,
    bindingManifestPath: MANIFEST_PATH,
    bindingManifestSha256: manifestSha256,
    authoredStageModulePath: binding.stageModule,
    authoredStageModuleSha256: fileDigest(binding.stageModule),
    inputCheckpointPath: firstStage.configPath,
    inputCheckpointSha256: firstStage.configSha256,
    outputCheckpointPath: lastStage.configPath,
    outputCheckpointSha256: lastStage.configSha256,
    fidelityOraclePath: GENERATOR_PATH,
    fidelityOracleSha256: fileDigest(GENERATOR_PATH),
    semanticsVerifierPath: SEMANTICS_VERIFIER_PATH,
    semanticsVerifierSha256: fileDigest(SEMANTICS_VERIFIER_PATH),
    stageCount: binding.stages.length,
    command: 'npm run validate-catalog',
    environment: 'phase1-foundation-node-20.19.4',
    toolVersions: {
      docusaurus: '3.9.2',
      node: '20.19.4',
    },
    generatedAt: `${record.lastTechnicalVerification}T00:00:00Z`,
    verifierLane: record.verifierLane,
    executionStatus: record.executionStatus,
    operationalEvidence: record.operationalEvidence,
  };
}

export function verifyExplorerProvenanceBindings(): ExplorerProvenanceVerification {
  const manifestBytes = readFileSync(resolve(MANIFEST_PATH));
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
  const explorerRecords = EXAMPLE_RECORDS.filter(
    (record) => record.routes.explore !== undefined
  );
  assert.equal(manifest.schemaVersion, 'explorer-stage-bindings-v1');
  assert.equal(manifest.normalization, 'exact-utf8-final-newline-v1');
  assert.deepEqual(
    manifest.explorers.map(({ exampleId }) => exampleId),
    explorerRecords.map(({ id }) => id),
    'Explorer evidence manifest and catalog order drifted'
  );

  const architectureIds: string[] = [];
  let stagesVerified = 0;
  for (const [index, record] of explorerRecords.entries()) {
    const binding = manifest.explorers[index];
    const evidence = record.explorerEvidence;
    assert.ok(evidence, `${record.id} has no explicit Explorer evidence`);
    assert.equal(evidence.exampleId, record.id);
    assert.equal(evidence.schemaDigest, EXPLORER_EVIDENCE_SCHEMA_DIGEST);
    assert.equal(evidence.canonicalPipelinePath, binding.canonicalPipelinePath);
    assert.equal(evidence.pipelineSha256, binding.pipelineSha256);
    assert.equal(evidence.bindingManifestPath, MANIFEST_PATH);
    assert.equal(evidence.bindingManifestSha256, sha256(manifestBytes));
    assert.equal(
      fileDigest(binding.canonicalPipelinePath),
      binding.pipelineSha256
    );
    assert.equal(evidence.authoredStageModulePath, binding.stageModule);
    assert.equal(
      evidence.authoredStageModuleSha256,
      fileDigest(binding.stageModule)
    );
    assert.equal(evidence.stageCount, binding.stages.length);
    assert.equal(evidence.executionStatus, record.executionStatus);
    assert.equal(evidence.operationalEvidence, record.operationalEvidence);
    assert.notEqual(evidence.verifierLane, record.producerLane);
    assert.equal(evidence.semanticsVerifierPath, SEMANTICS_VERIFIER_PATH);
    assert.equal(
      evidence.semanticsVerifierSha256,
      fileDigest(SEMANTICS_VERIFIER_PATH)
    );

    if (record.id === 'remove-pii') {
      assert.deepEqual(evidence, REMOVE_PII_EXPLORER_EVIDENCE);
      assert.equal(
        evidence.fidelityOraclePath,
        'scripts/quality/remove-pii-fidelity.ts'
      );
      assert.equal(
        evidence.fidelityOracleSha256,
        fileDigest(evidence.fidelityOraclePath)
      );
      assert.equal(
        evidence.inputCheckpointSha256,
        fileDigest(evidence.inputCheckpointPath)
      );
      assert.equal(
        evidence.outputCheckpointSha256,
        fileDigest(evidence.outputCheckpointPath)
      );
      stagesVerified += binding.stages.length;
      continue;
    }

    assert.equal(record.executionStatus, 'architecture-only');
    assert.equal(evidence.kind, 'curated-explanation');
    assert.equal(evidence.verifierLane, record.verifierLane);
    architectureIds.push(record.id);
    verifyLiteralStageSemantics(binding);
    for (const stage of binding.stages) {
      assert.equal(fileDigest(stage.configPath), stage.configSha256);
    }
    assert.deepEqual(
      evidence,
      expectedArchitectureEvidence(record, binding, sha256(manifestBytes)),
      `${record.id} generated Explorer evidence drifted`
    );
    assert.deepEqual(
      GENERATED_ARCHITECTURE_EXPLORER_EVIDENCE[record.id],
      evidence,
      `${record.id} registry evidence is not the generated binding`
    );
    stagesVerified += binding.stages.length;
  }

  assert.deepEqual(
    Object.keys(GENERATED_ARCHITECTURE_EXPLORER_EVIDENCE),
    architectureIds,
    'generated architecture Explorer evidence inventory drifted'
  );
  assert.deepEqual(
    Object.keys(GENERATED_EXPLORER_STAGE_CONFIGS),
    explorerRecords.map(({ id }) => id),
    'generated Explorer stage inventory drifted'
  );

  return {
    schemaDigest: EXPLORER_EVIDENCE_SCHEMA_DIGEST,
    explorersVerified: explorerRecords.length,
    architectureBindingsVerified: architectureIds.length,
    strengthenedFidelityBindingsVerified: 1,
    stagesVerified,
    status: 'PASS',
  };
}
