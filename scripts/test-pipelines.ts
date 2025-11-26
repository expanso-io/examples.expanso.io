import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const TEST_DIR = 'examples';
const BIN_DIR = path.join(process.cwd(), '.bin');

const CLI_BINARY = path.join(BIN_DIR, 'expanso-cli');
const EDGE_BINARY = path.join(BIN_DIR, 'expanso-edge');

const RUN_WITH_EXPANSO_SCRIPT = path.join(process.cwd(), 'scripts', 'run-with-expanso.ts');

async function runPipelineTests() {
  console.log('🧪 Starting pipeline validation...');

  // 1. Verify Binaries
  try {
    execSync(['npx', 'tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY, 'version'].join(' '), { stdio: 'ignore' });
    console.log('✅ Expanso CLI binary found.');
  } catch (e: any) {
    console.error('❌ Expanso CLI binary not found/executable. Run `npm run setup-binaries` first.');
    process.exit(1);
  }

  // 2. Run Validation
  const pipelineFiles = await glob(`${TEST_DIR}/**/*.yaml`);
  console.log(`Found ${pipelineFiles.length} pipeline files to validate.`);

  let totalPassed = 0;
  let totalFailed = 0;

  for (const pipelineFile of pipelineFiles) {
    const relativePath = path.relative(process.cwd(), pipelineFile);
    console.log('\n--- Validating ' + relativePath + ' ---');

    try {
      const validateCmd = ['npx', 'tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY, 'job', 'validate', pipelineFile].join(' ');
      execSync(validateCmd, { stdio: 'inherit' });
      console.log(`✅ Validated.`);
      totalPassed++;
    } catch (e: any) {
      console.error(`❌ Validation failed for ${relativePath}`);
      totalFailed++;
    }
  }

  console.log('--------------------------------------------------');
  console.log(`Summary:`);
  console.log(`Pipelines Validated: ${totalPassed + totalFailed}`);
  console.log(`Passed:           ${totalPassed}`);
  console.log(`Failed:           ${totalFailed}`);
  console.log('--------------------------------------------------');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPipelineTests().catch(e => {
    console.error(e);
    process.exit(1);
});
