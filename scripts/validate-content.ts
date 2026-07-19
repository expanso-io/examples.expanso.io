import { resolve } from 'node:path';
import { validateContent } from './content-validation/content';
import { parseArguments, requireArgument } from './content-validation/io';

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const argumentsMap = parseArguments(process.argv.slice(2));
  const result = await validateContent({
    repositoryRoot,
    inputRoot: resolve(
      repositoryRoot,
      requireArgument(argumentsMap, 'root', 'docs')
    ),
    policyPath: resolve(
      repositoryRoot,
      requireArgument(
        argumentsMap,
        'policy',
        'content/contracts/content-policy-v1.json'
      )
    ),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ gateId: 'content-validator-v1', status: 'FAIL', fatalError: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
});
