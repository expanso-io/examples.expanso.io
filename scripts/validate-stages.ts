#!/usr/bin/env ts-node

/**
 * Validation script for stage files
 *
 * Checks that all *-full.stages.ts files:
 * - Export an array of Stage objects
 * - Have sequential stage IDs (1, 2, 3, ...)
 * - Have all required Stage properties
 * - Use new format (inputLines/outputLines arrays, not legacy input/output strings)
 * - Have valid JsonLine objects
 *
 * Usage:
 *   npm run validate-stages
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ValidationError {
  file: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Find all stage files in docs/ directory
 */
async function findStageFiles(): Promise<string[]> {
  const pattern = 'docs/**/*-full.stages.ts';
  const files = await glob(pattern, { cwd: process.cwd() });
  return files;
}

/**
 * Validate a single stage file
 */
function validateStageFile(filePath: string): ValidationResult {
  const errors: ValidationError[] = [];
  const absolutePath = path.join(process.cwd(), filePath);

  // Check file exists
  if (!fs.existsSync(absolutePath)) {
    return {
      file: filePath,
      valid: false,
      errors: [{
        file: filePath,
        message: 'File does not exist',
        severity: 'error',
      }],
    };
  }

  // Read file content
  const content = fs.readFileSync(absolutePath, 'utf8');

  // Check for Stage type import
  if (!content.includes("import type { Stage }") && !content.includes("import { Stage }")) {
    errors.push({
      file: filePath,
      message: 'Missing Stage type import from DataPipelineExplorer/types',
      severity: 'error',
    });
  }

  // Check for export statement
  const exportMatch = content.match(/export const (\w+): Stage\[\] = \[/);
  if (!exportMatch) {
    errors.push({
      file: filePath,
      message: 'Missing or invalid Stage[] export',
      severity: 'error',
    });
    return { file: filePath, valid: false, errors };
  }

  // Check for legacy format (input/output as strings instead of inputLines/outputLines)
  if (content.includes('input:') && !content.includes('inputLines:')) {
    errors.push({
      file: filePath,
      message: 'Uses legacy "input" property instead of "inputLines"',
      severity: 'error',
    });
  }

  if (content.includes('output:') && !content.includes('outputLines:')) {
    errors.push({
      file: filePath,
      message: 'Uses legacy "output" property instead of "outputLines"',
      severity: 'error',
    });
  }

  // Check for required Stage properties
  const requiredProps = ['id:', 'title:', 'description:', 'yamlCode:', 'yamlFilename:', 'inputLines:', 'outputLines:'];
  for (const prop of requiredProps) {
    if (!content.includes(prop)) {
      errors.push({
        file: filePath,
        message: `Missing required property: ${prop.replace(':', '')}`,
        severity: 'error',
      });
    }
  }

  // Extract stage IDs using regex
  const idMatches = [...content.matchAll(/id:\s*(\d+)/g)];
  if (idMatches.length === 0) {
    errors.push({
      file: filePath,
      message: 'No stage IDs found',
      severity: 'error',
    });
  } else {
    // Check that IDs are sequential starting from 1
    const ids = idMatches.map(match => parseInt(match[1], 10));
    const expectedIds = Array.from({ length: ids.length }, (_, i) => i + 1);

    if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
      errors.push({
        file: filePath,
        message: `Stage IDs are not sequential. Found: [${ids.join(', ')}], expected: [${expectedIds.join(', ')}]`,
        severity: 'error',
      });
    }
  }

  // Check for inputLines and outputLines arrays
  if (content.includes('inputLines:') && !content.match(/inputLines:\s*\[/)) {
    errors.push({
      file: filePath,
      message: 'inputLines should be an array',
      severity: 'warning',
    });
  }

  if (content.includes('outputLines:') && !content.match(/outputLines:\s*\[/)) {
    errors.push({
      file: filePath,
      message: 'outputLines should be an array',
      severity: 'warning',
    });
  }

  // Check for valid JsonLine properties (content, indent)
  const jsonLineRegex = /{\s*content:/g;
  const jsonLineMatches = [...content.matchAll(jsonLineRegex)];

  if (jsonLineMatches.length === 0 && content.includes('inputLines:')) {
    errors.push({
      file: filePath,
      message: 'No JsonLine objects found in inputLines/outputLines',
      severity: 'warning',
    });
  }

  return {
    file: filePath,
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  console.log('🔍 Validating stage files...\n');

  const stageFiles = await findStageFiles();

  if (stageFiles.length === 0) {
    console.log('⚠️  No stage files found');
    return;
  }

  console.log(`Found ${stageFiles.length} stage file(s):\n`);

  const results: ValidationResult[] = [];
  let hasErrors = false;

  for (const file of stageFiles) {
    const result = validateStageFile(file);
    results.push(result);

    if (result.valid) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file}`);
      hasErrors = true;
    }

    // Print errors/warnings
    for (const error of result.errors) {
      const prefix = error.severity === 'error' ? '   ❌' : '   ⚠️ ';
      console.log(`${prefix} ${error.message}`);
    }

    if (result.errors.length > 0) {
      console.log('');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  const validFiles = results.filter(r => r.valid).length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.filter(e => e.severity === 'error').length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.errors.filter(e => e.severity === 'warning').length, 0);

  console.log(`\n📊 Validation Summary:`);
  console.log(`   Valid files: ${validFiles}/${stageFiles.length}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Warnings: ${totalWarnings}`);

  if (hasErrors) {
    console.log('\n❌ Validation failed\n');
    process.exit(1);
  } else {
    console.log('\n✅ All stage files are valid!\n');
  }
}

main().catch(error => {
  console.error('❌ Validation script failed:', error);
  process.exit(1);
});
