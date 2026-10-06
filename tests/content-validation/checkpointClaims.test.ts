import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { it } from 'node:test';
import { validateClaimsEvidence } from '../../scripts/content-validation/claims';
import { sha256 } from '../../scripts/content-validation/io';

it('scans rendered checkpoint explanations while excluding pipeline identifiers', async () => {
  const repositoryRoot = await mkdtemp(resolve('.nm-checkpoint-claims-'));
  const contentPolicyPath = resolve('content/contracts/content-policy-v1.json');
  const claimsPolicyPath = resolve('content/contracts/claims-policy-v1.json');
  const datasetPolicyPath = resolve('content/contracts/dataset-policy-v1.json');
  const claimsDigest = sha256(await readFile(claimsPolicyPath));
  const datasetDigest = sha256(await readFile(datasetPolicyPath));
  const inputRoot = resolve(repositoryRoot, 'docs');
  try {
    await mkdir(inputRoot);
    await mkdir(resolve(repositoryRoot, 'examples'));
    await writeFile(
      resolve(repositoryRoot, 'claims.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        policyVersion: 'claims-evidence-v1',
        policyDigest: claimsDigest,
        claims: [],
      })
    );
    await writeFile(
      resolve(repositoryRoot, 'datasets.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        policyVersion: 'dataset-evidence-v1',
        policyDigest: datasetDigest,
        datasets: [],
      })
    );
    await writeFile(
      resolve(inputRoot, 'index.mdx'),
      `---
title: Checkpoint example
contentArchetype: explorer
executionStatus: architecture-only
operationalEvidence: not-assessed
claimIds: []
claimsVerifiedBy: verifier-agent
claimsVerifiedAt: '2026-07-18'
claimsPolicyDigest: ${claimsDigest}
---

import DataPipelineExplorer from '@site/src/components/DataPipelineExplorer';
import { stages } from './stages';

<DataPipelineExplorer stages={stages} title="Checkpoint" />
`
    );
    const validate = async (content: string) => {
      await writeFile(
        resolve(inputRoot, 'stages.ts'),
        `export const stages = [{
        id: 1, title: 'Inspect a row', description: 'Inspect the synthetic row.',
        inputLines: [{ content: 'synthetic input' }],
        outputLines: [{ content: ${JSON.stringify(content)} }],
      }];`
      );
      return validateClaimsEvidence({
        repositoryRoot,
        inputRoot,
        contentPolicyPath,
        claimsPolicyPath,
        datasetPolicyPath,
        claimRegistryPath: resolve(repositoryRoot, 'claims.json'),
        datasetRegistryPath: resolve(repositoryRoot, 'datasets.json'),
        today: '2026-07-18',
        now: new Date('2026-07-18T12:00:00Z'),
      });
    };
    const identifier = await validate(
      '"pipeline": "eu-cross-border-compliance",'
    );
    assert.equal(identifier.status, 'PASS', JSON.stringify(identifier.errors));
    for (const text of [
      '# Guaranteed 80% cost reduction',
      'Guaranteed 80% cost reduction',
      '"message": "Guaranteed 80% cost reduction",',
      '"pipeline": "ensures compliance",',
      '"status": "compliant",',
    ]) {
      const result = await validate(text);
      assert.equal(result.status, 'FAIL', text);
      assert.ok(
        result.errors.some((error) => error.code === 'CLAIM_UNMAPPED'),
        JSON.stringify(result.errors)
      );
    }
    const forbidden = await validate('# This pipeline ensures compliance.');
    assert.ok(
      forbidden.errors.some((error) => error.code === 'PROHIBITED_CLAIM'),
      JSON.stringify(forbidden.errors)
    );
    const privatePayload = await validate(
      '/Us' + 'ers/private/customer transcript'
    );
    assert.ok(
      privatePayload.errors.some(
        (error) => error.code === 'PRIVATE_EVIDENCE_LEAK'
      ),
      JSON.stringify(privatePayload.errors)
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});
