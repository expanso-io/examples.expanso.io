#!/usr/bin/env ts-node

/**
 * Legacy Stage File Migration Script
 *
 * Automatically converts legacy stage files to the new format:
 * - Legacy: { stage, yaml, input, output }
 * - New: { id, yamlCode, yamlFilename, inputLines, outputLines }
 *
 * Usage:
 *   npm run migrate-stages
 *   npm run migrate-stages -- --file docs/data-routing/priority-queues-full.stages.ts
 *   npm run migrate-stages -- --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface MigrationResult {
  file: string;
  success: boolean;
  message: string;
  isLegacy: boolean;
}

/**
 * Check if a stage file uses legacy format
 */
function isLegacyFormat(content: string): boolean {
  // Legacy files have 'stage:' instead of 'id:' and 'yaml:' instead of 'yamlCode:'
  const hasLegacyStage = content.includes('stage:') && !content.includes('id:');
  const hasLegacyYaml = content.includes('yaml:') && !content.includes('yamlCode:');
  const hasLegacyInput = /input:\s*`/.test(content);
  const hasLegacyOutput = /output:\s*`/.test(content);

  return hasLegacyStage || hasLegacyYaml || hasLegacyInput || hasLegacyOutput;
}

/**
 * Convert legacy stage file to new format
 */
function migrateLegacyStage(content: string): string {
  let migrated = content;

  // Step 1: Add Stage type import if missing
  if (!migrated.includes("import type { Stage }") && !migrated.includes("import { Stage }")) {
    migrated = `import type { Stage } from '@site/src/components/DataPipelineExplorer/types';\n\n` + migrated;
  }

  // Step 2: Replace 'stage:' with 'id:'
  migrated = migrated.replace(/(\s+)stage:\s*(\d+)/g, '$1id: $2');

  // Step 3: Replace 'yaml:' with 'yamlCode:' and add yamlFilename
  migrated = migrated.replace(/(\s+)yaml:\s*`/g, (match, indent) => {
    return `${indent}yamlFilename: 'pipeline.yaml',\n${indent}yamlCode: \``;
  });

  // Step 4: Convert input strings to inputLines arrays
  // This is complex - for now, create a condensed single-line representation
  migrated = migrated.replace(/(\s+)input:\s*`([^`]+)`/g, (match, indent, inputContent) => {
    const trimmed = inputContent.trim();
    return `${indent}inputLines: [\n${indent}  { content: '${trimmed.replace(/'/g, "\\'")}', indent: 0 }\n${indent}]`;
  });

  // Step 5: Convert output strings to outputLines arrays
  migrated = migrated.replace(/(\s+)output:\s*`([^`]+)`/g, (match, indent, outputContent) => {
    const trimmed = outputContent.trim();
    return `${indent}outputLines: [\n${indent}  { content: '${trimmed.replace(/'/g, "\\'")}', indent: 0 }\n${indent}]`;
  });

  // Step 6: Update export to use Stage[] type
  migrated = migrated.replace(/export const (\w+) = \[/, 'export const $1: Stage[] = [');

  return migrated;
}

/**
 * Migrate a single file
 */
function migrateFile(filePath: string, dryRun: boolean = false): MigrationResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        file: filePath,
        success: false,
        message: 'File does not exist',
        isLegacy: false,
      };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const legacy = isLegacyFormat(content);

    if (!legacy) {
      return {
        file: filePath,
        success: true,
        message: 'Already in new format',
        isLegacy: false,
      };
    }

    const migrated = migrateLegacyStage(content);

    if (!dryRun) {
      // Create backup
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content);

      // Write migrated content
      fs.writeFileSync(filePath, migrated);

      return {
        file: filePath,
        success: true,
        message: `Migrated successfully (backup: ${backupPath})`,
        isLegacy: true,
      };
    } else {
      return {
        file: filePath,
        success: true,
        message: 'Would migrate (dry run)',
        isLegacy: true,
      };
    }
  } catch (error) {
    return {
      file: filePath,
      success: false,
      message: `Error: ${error.message}`,
      isLegacy: false,
    };
  }
}

/**
 * Find all stage files
 */
async function findAllStageFiles(): Promise<string[]> {
  const pattern = 'docs/**/*-full.stages.ts';
  const files = await glob(pattern, { cwd: process.cwd() });
  return files.map(f => path.join(process.cwd(), f));
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let dryRun = false;
  let specificFile: string | undefined;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--file' && i + 1 < args.length) {
      specificFile = args[i + 1];
      i++;
    }
  }

  console.log('🔄 Stage File Migration Script\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  let filesToMigrate: string[];

  if (specificFile) {
    filesToMigrate = [path.join(process.cwd(), specificFile)];
    console.log(`Migrating specific file: ${specificFile}\n`);
  } else {
    filesToMigrate = await findAllStageFiles();
    console.log(`Found ${filesToMigrate.length} stage file(s)\n`);
  }

  const results: MigrationResult[] = [];

  for (const file of filesToMigrate) {
    const result = migrateFile(file, dryRun);
    results.push(result);

    const relativePath = path.relative(process.cwd(), file);

    if (result.isLegacy && result.success) {
      console.log(`🔄 ${relativePath}`);
      console.log(`   ${result.message}`);
    } else if (!result.isLegacy && result.success) {
      console.log(`✅ ${relativePath}`);
      console.log(`   ${result.message}`);
    } else {
      console.log(`❌ ${relativePath}`);
      console.log(`   ${result.message}`);
    }

    console.log('');
  }

  // Summary
  console.log('='.repeat(80));

  const migrated = results.filter(r => r.isLegacy && r.success).length;
  const alreadyNew = results.filter(r => !r.isLegacy && r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n📊 Migration Summary:');
  console.log(`   Files migrated: ${migrated}`);
  console.log(`   Already new format: ${alreadyNew}`);
  console.log(`   Failed: ${failed}`);

  if (dryRun && migrated > 0) {
    console.log('\n💡 Run without --dry-run to apply migrations');
  }

  if (migrated > 0 && !dryRun) {
    console.log('\n✅ Migration complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Review the migrated files manually');
    console.log('   2. Run `npm run validate-stages` to check correctness');
    console.log('   3. Run `npm start` to preview changes');
    console.log('   4. Delete .backup files once satisfied');
  }

  console.log('');
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
