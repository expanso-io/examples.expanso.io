import { resolve } from 'node:path';
import { EXAMPLE_RECORDS } from '../src/catalog/registry';
import { validateClaimsEvidence } from './content-validation/claims';
import { validateContent } from './content-validation/content';
import type { Finding, ValidationResult } from './content-validation/types';
import { parseArguments, requireArgument } from './content-validation/io';

type EstateStatus = 'PASS' | 'FAIL' | 'UNKNOWN';
type Stage = 'foundation' | 'migration';

interface ValidatorObservation {
  gateId: string;
  status: EstateStatus;
  filesChecked: number;
  findings: number;
  findingsByCode: Record<string, number>;
  result?: ValidationResult;
  fatalError?: string;
}

async function observe(
  gateId: string,
  run: () => Promise<ValidationResult>
): Promise<ValidatorObservation> {
  try {
    const result = await run();
    return {
      gateId,
      status: result.status,
      filesChecked: result.filesChecked,
      findings: result.errors.length,
      findingsByCode: countByCode(result.errors),
      result,
    };
  } catch (error) {
    return {
      gateId,
      status: 'UNKNOWN',
      filesChecked: 0,
      findings: 0,
      findingsByCode: {},
      fatalError: error instanceof Error ? error.message : String(error),
    };
  }
}

function countByCode(findings: Finding[]): Record<string, number> {
  return findings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.code] = (counts[finding.code] ?? 0) + 1;
    return counts;
  }, {});
}

function aggregate(observations: ValidatorObservation[]): EstateStatus {
  if (observations.some((observation) => observation.status === 'UNKNOWN')) {
    return 'UNKNOWN';
  }
  return observations.every((observation) => observation.status === 'PASS')
    ? 'PASS'
    : 'FAIL';
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const stageValue = requireArgument(args, 'stage', 'foundation');
  if (stageValue !== 'foundation' && stageValue !== 'migration') {
    throw new Error('--stage must be foundation or migration');
  }
  const stage: Stage = stageValue;
  const repositoryRoot = process.cwd();
  const contentPolicyPath = resolve(
    repositoryRoot,
    'content/contracts/content-policy-v1.json'
  );
  const claimsPolicyPath = resolve(
    repositoryRoot,
    'content/contracts/claims-policy-v1.json'
  );
  const datasetPolicyPath = resolve(
    repositoryRoot,
    'content/contracts/dataset-policy-v1.json'
  );
  const observations = await Promise.all([
    observe('content-validator-v1', () =>
      validateContent({
        repositoryRoot,
        inputRoot: resolve(repositoryRoot, 'docs'),
        policyPath: contentPolicyPath,
      })
    ),
    observe('claims-evidence-v1', () =>
      validateClaimsEvidence({
        repositoryRoot,
        inputRoot: resolve(repositoryRoot, 'docs'),
        contentPolicyPath,
        claimsPolicyPath,
        datasetPolicyPath,
        claimRegistryPath: resolve(
          repositoryRoot,
          'content/claims/claims-v1.json'
        ),
        datasetRegistryPath: resolve(
          repositoryRoot,
          'content/datasets/datasets-v1.json'
        ),
        catalogRecords: EXAMPLE_RECORDS.map((record) => ({
          id: record.id,
          claimIds: [...record.claimIds],
          fixturePath: record.fixturePath,
          expectedOutputPath: record.expectedOutputPath,
          lastTechnicalVerification: record.lastTechnicalVerification,
          lastEditorialVerification: record.lastEditorialVerification,
        })),
      })
    ),
  ]);
  const status = aggregate(observations);
  const claimedGate = stage === 'migration';
  const report = {
    contractVersion: '1.0.0',
    gateId: 'content-estate-v1',
    stage,
    claimedGate,
    enforcement: claimedGate ? 'enforced' : 'observational-debt',
    status,
    checkedAt: new Date().toISOString(),
    validators: observations,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (claimedGate && status !== 'PASS') process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stdout.write(
    `${JSON.stringify({ contractVersion: '1.0.0', gateId: 'content-estate-v1', stage: 'unknown', claimedGate: false, enforcement: 'unknown', status: 'UNKNOWN', checkedAt: new Date().toISOString(), validators: [], fatalError: error instanceof Error ? error.message : String(error) }, null, 2)}\n`
  );
  process.exitCode = 1;
});
