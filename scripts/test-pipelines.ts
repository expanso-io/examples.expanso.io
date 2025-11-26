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
    execSync(['tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY, 'version'].join(' '), { stdio: 'ignore' });
    console.log('✅ Expanso CLI binary found.');
  } catch (e: any) {
    console.error('❌ Expanso CLI binary not found/executable. Run `npm run setup-binaries` first.');
    process.exit(1);
  }

  // 2. Run Validation
  const pipelineFiles = await glob(`${TEST_DIR}/**/*-complete.yaml`);
  console.log(`Found ${pipelineFiles.length} complete pipeline files to validate.`);

  let validated = 0;
  let skipped = 0;
  let failed = 0;

  for (const pipelineFile of pipelineFiles) {
    const relativePath = path.relative(process.cwd(), pipelineFile);
    console.log('\n--- ' + relativePath + ' ---');

    try {
      const fileContent = fs.readFileSync(pipelineFile, 'utf-8');

      // Skip Kubernetes-style manifests
      if (fileContent.includes('apiVersion:')) {
        console.log(`ℹ️  Skipped (Kubernetes manifest)`);
        skipped++;
        continue;
      }

      // Files named *-complete.yaml MUST have config: wrapper
      // If missing, fail validation (naming implies it should be complete)
      if (!fileContent.match(/^config:/m)) {
        console.error(`❌ Missing config: wrapper (required for -complete.yaml files)`);
        failed++;
        continue;
      }

      const validateCmd = [
        'tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY,
        'job', 'validate', pipelineFile, '--offline'
      ].join(' ');
      execSync(validateCmd, { stdio: 'inherit' });
      console.log(`✅ Validated`);
      validated++;
    } catch (e: any) {
      console.error(`❌ Failed`);
      failed++;
    }
  }

  console.log('\n--------------------------------------------------');
  console.log('Summary:');
  console.log(`  Total files:  ${validated + skipped + failed}`);
  console.log(`  Validated:    ${validated}`);
  console.log(`  Skipped:      ${skipped} (fragments/k8s)`);
  console.log(`  Failed:       ${failed}`);
  console.log('--------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPipelineTests().catch(e => {
    console.error(e);
    process.exit(1);
});
