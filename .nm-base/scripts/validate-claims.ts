import { resolve } from 'node:path';
import { EXAMPLE_RECORDS } from '../src/catalog/registry';
import { validateClaimsEvidence } from './content-validation/claims';
import { parseArguments, requireArgument } from './content-validation/io';

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const args = parseArguments(process.argv.slice(2));
  const catalogId = args.get('catalog-id');
  const fixtureScopePrefixes = args
    .get('fixture-prefix')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const catalogRecords = catalogId
    ? EXAMPLE_RECORDS.filter((record) => record.id === catalogId)
    : EXAMPLE_RECORDS;
  if (catalogId && catalogRecords.length !== 1) {
    throw new Error(`Unknown --catalog-id: ${catalogId}`);
  }
  if (args.has('fixture-prefix') && fixtureScopePrefixes?.length === 0) {
    throw new Error('--fixture-prefix must contain at least one path prefix');
  }
  const result = await validateClaimsEvidence({
    repositoryRoot,
    inputRoot: resolve(repositoryRoot, requireArgument(args, 'root', 'docs')),
    contentPolicyPath: resolve(
      repositoryRoot,
      requireArgument(
        args,
        'content-policy',
        'content/contracts/content-policy-v1.json'
      )
    ),
    claimsPolicyPath: resolve(
      repositoryRoot,
      requireArgument(
        args,
        'claims-policy',
        'content/contracts/claims-policy-v1.json'
      )
    ),
    datasetPolicyPath: resolve(
      repositoryRoot,
      requireArgument(
        args,
        'dataset-policy',
        'content/contracts/dataset-policy-v1.json'
      )
    ),
    claimRegistryPath: resolve(
      repositoryRoot,
      requireArgument(args, 'claims', 'content/claims/claims-v1.json')
    ),
    datasetRegistryPath: resolve(
      repositoryRoot,
      requireArgument(args, 'datasets', 'content/datasets/datasets-v1.json')
    ),
    catalogRecords: catalogRecords.map((record) => ({
      id: record.id,
      claimIds: [...record.claimIds],
      fixturePath: record.fixturePath,
      expectedOutputPath: record.expectedOutputPath,
      lastTechnicalVerification: record.lastTechnicalVerification,
      lastEditorialVerification: record.lastEditorialVerification,
    })),
    fixtureScopePrefixes,
    today: args.get('today'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ gateId: 'claims-evidence-v1', status: 'FAIL', fatalError: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
});
