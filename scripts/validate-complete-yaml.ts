#!/usr/bin/env npx tsx
/**
 * Pre-commit validation for -complete.yaml files.
 * Ensures all complete pipeline files have the required structure.
 * This is a lightweight check that doesn't require CLI binaries.
 */

import fs from 'fs';
import path from 'path';

function validateFile(filePath: string): string[] {
  const errors: string[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');

  // Skip Kubernetes manifests
  if (content.includes('apiVersion:')) {
    return [];
  }

  // Check for config: wrapper (required for -complete.yaml files)
  if (!content.match(/^config:/m)) {
    errors.push(`Missing 'config:' wrapper (required for -complete.yaml files)`);
  }

  // Check for name at the start of a line (not indented)
  if (!content.match(/^name:/m)) {
    errors.push(`Missing 'name:' field at root level`);
  }

  // Check for type: pipeline at the start of a line
  if (!content.match(/^type:\s*pipeline/m)) {
    errors.push(`Missing 'type: pipeline' field at root level`);
  }

  // Check for description at the start of a line
  if (!content.match(/^description:/m)) {
    errors.push(`Missing 'description:' field at root level`);
  }

  // Check for namespace at the start of a line
  if (!content.match(/^namespace:/m)) {
    errors.push(`Missing 'namespace:' field at root level`);
  }

  // Check for labels at the start of a line
  if (!content.match(/^labels:/m)) {
    errors.push(`Missing 'labels:' field at root level`);
  }

  // Check that input/pipeline/output are NOT at root level (should be under config:)
  // This catches the case where someone forgets to wrap them in config:
  if (content.match(/^input:/m)) {
    errors.push(`'input:' should be nested under 'config:', not at root level`);
  }
  if (content.match(/^pipeline:/m)) {
    errors.push(`'pipeline:' should be nested under 'config:', not at root level`);
  }
  if (content.match(/^output:/m)) {
    errors.push(`'output:' should be nested under 'config:', not at root level`);
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);

  // If files are passed as arguments (from lint-staged), validate those
  // Otherwise, find all -complete.yaml files
  let filesToCheck: string[] = [];

  if (args.length > 0) {
    filesToCheck = args.filter((f) => f.endsWith('-complete.yaml'));
  } else {
    // Find all -complete.yaml files in examples/
    const { glob } = require('glob');
    filesToCheck = glob.sync('examples/**/*-complete.yaml');
  }

  if (filesToCheck.length === 0) {
    console.log('No -complete.yaml files to validate.');
    process.exit(0);
  }

  let hasErrors = false;
  let validatedCount = 0;

  for (const file of filesToCheck) {
    const relativePath = path.relative(process.cwd(), file);
    const errors = validateFile(file);

    if (errors.length > 0) {
      console.error(`\n❌ ${relativePath}:`);
      errors.forEach((e) => console.error(`   - ${e}`));
      hasErrors = true;
    } else {
      validatedCount++;
    }
  }

  if (hasErrors) {
    console.error(`\n❌ Validation failed. Fix the above errors before committing.`);
    console.error(
      `   See a working example: examples/log-processing/filter-severity-complete.yaml`
    );
    process.exit(1);
  }

  console.log(`✅ Validated ${validatedCount} -complete.yaml file(s).`);
  process.exit(0);
}

main();
