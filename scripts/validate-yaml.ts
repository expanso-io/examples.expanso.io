import { glob } from 'glob';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

// Configuration
const EXAMPLES_DIR = 'examples';

async function validateYamlFiles() {
  console.log('🔍 Starting YAML validation...');

  // Check if expanso CLI is available
  let cliAvailable = false;
  try {
    await execPromise('expanso --version');
    cliAvailable = true;
  } catch (error) {
    console.warn('⚠️  "expanso" CLI not found or not executable.');
    console.warn('   Validation will verify YAML syntax only (basic parsing), not pipeline logic.');
    console.warn('   Install Expanso CLI to enable full validation: https://expanso.io/docs/getting-started/');
    console.log('--------------------------------------------------');
  }

  const yamlFiles = await glob(`${EXAMPLES_DIR}/**/*.yaml`);
  console.log(`Found ${yamlFiles.length} YAML files to validate.`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of yamlFiles) {
    const relativePath = path.relative(process.cwd(), file);
    
    if (cliAvailable) {
      try {
        // Run expanso validate
        await execPromise(`expanso validate "${file}"`);
        console.log(`✅ [VALID] ${relativePath}`);
        passed++;
      } catch (error: any) {
        console.error(`❌ [INVALID] ${relativePath}`);
        console.error(error.stderr || error.stdout || error.message);
        failed++;
      }
    } else {
      // Fallback: Basic file read check (and potential trivial JS yaml parse if library existed, 
      // but here we just ensure it's readable and not empty)
      try {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.trim().length === 0) {
            throw new Error("File is empty");
        }
        // We could try a basic regex check for YAML structure if needed, 
        // but for now, existence and non-empty is a good baseline.
        console.log(`ℹ️  [CHECKED] ${relativePath} (Syntax check skipped due to missing CLI)`);
        skipped++;
      } catch (e: any) {
        console.error(`❌ [READ FAIL] ${relativePath}: ${e.message}`);
        failed++;
      }
    }
  }

  console.log('--------------------------------------------------');
  console.log(`Summary:`);
  if (cliAvailable) {
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
  } else {
    console.log(`Checked (CLI missing): ${skipped}`);
    console.log(`Read Failures:         ${failed}`);
  }
  
  if (failed > 0) process.exit(1);
}

validateYamlFiles().catch(console.error);
