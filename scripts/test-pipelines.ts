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
  console.log('🧪 Starting pipeline integration tests...');

  // 1. Verify Binaries
  try {
    execSync(['tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY, 'version'].join(' '), { stdio: 'ignore' });
    execSync(['tsx', RUN_WITH_EXPANSO_SCRIPT, EDGE_BINARY, 'version'].join(' '), { stdio: 'ignore' });
    console.log('✅ Expanso CLI and Edge binaries found.');
  } catch (e: any) {
    console.error('❌ Expanso CLI or Edge binaries not found/executable. Run `npm run setup-binaries` first.');
    process.exit(1);
  }

  // 2. Start Standalone Expanso Edge
  console.log('🚀 Starting standalone Expanso Edge...');
  
  // We start expanso-edge in the background. 
  // Note: We assume standard ports (8080 for API, etc.) are free.
  const edgeProcess = spawn('tsx', [RUN_WITH_EXPANSO_SCRIPT, EDGE_BINARY, 'run', '--local'], {
    stdio: 'ignore', // Ignore output to keep test log clean, or 'inherit' to debug
    detached: false
  });

  let edgeRunning = true;
  edgeProcess.on('error', (err) => {
    console.error('❌ Failed to start expanso-edge:', err);
    edgeRunning = false;
  });

  edgeProcess.on('exit', (code) => {
    if (edgeRunning) {
        console.warn(`⚠️  expanso-edge exited unexpectedly with code ${code}`);
        edgeRunning = false;
    }
  });

  // Ensure cleanup on exit
  const cleanup = () => {
    if (edgeRunning) {
      console.log('\n🛑 Stopping Expanso Edge...');
      edgeProcess.kill();
      edgeRunning = false;
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(); });
  process.on('SIGTERM', () => { cleanup(); process.exit(); });

  // Wait for Edge to be ready (simple delay for now, could poll health endpoint)
  console.log('⏳ Waiting 5s for Expanso Edge to initialize...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (!edgeRunning) {
      console.error('❌ Expanso Edge failed to start or crashed.');
      process.exit(1);
  }
  console.log('✅ Expanso Edge is running.');

  // 3. Run Tests
  const pipelineFiles = await glob(`${TEST_DIR}/**/*-complete.yaml`);
  console.log(`Found ${pipelineFiles.length} complete pipeline files to test.`);

  let totalPassed = 0;
  let totalFailed = 0;

  for (const pipelineFile of pipelineFiles) {
    const relativePath = path.relative(process.cwd(), pipelineFile);
    console.log('\n--- Testing ' + relativePath + ' ---');

    try {
      // Deploy
      console.log(`📤 Deploying ${relativePath}...`);
      const deployCmd = ['tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY, 'job', 'deploy', pipelineFile, '--profile', 'local'].join(' ');
      execSync(deployCmd, { stdio: 'inherit' });
      console.log(`✅ Deployed.`);

      // Placeholder for data injection
      console.log(`ℹ️  (Data injection/assertion would happen here)`);

      totalPassed++;
    } catch (e: any) {
      console.error(`❌ Test failed for ${relativePath}`);
      // console.error(e.message); // Output is usually inherited, so redundant
      totalFailed++;
    } finally {
      // Undeploy
      try {
        const jobName = path.basename(pipelineFile, '.yaml');
        const deleteCmd = ['tsx', RUN_WITH_EXPANSO_SCRIPT, CLI_BINARY, 'job', 'delete', jobName, '--profile', 'local'].join(' ');
        execSync(deleteCmd, { stdio: 'ignore' });
        // console.log(`✅ Undeployed.`);
      } catch (e) { 
          // Ignore undeploy errors (job might not exist if deploy failed)
      }
    }
  }

  // Cleanup happens automatically via process.on('exit')
  
  console.log('--------------------------------------------------');
  console.log(`Summary:`);
  console.log(`Pipelines Tested: ${totalPassed + totalFailed}`);
  console.log(`Passed:           ${totalPassed}`);
  console.log(`Failed:           ${totalFailed}`);
  console.log('--------------------------------------------------');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
      // Explicitly exit to trigger cleanup
      process.exit(0);
  }
}

runPipelineTests().catch(e => {
    console.error(e);
    process.exit(1);
});
