#!/usr/bin/env ts-node

/**
 * Interactive Scaffold Inventory
 *
 * Finds examples that have a *-full.stages.ts file in the four original
 * interactive categories and verifies their required scaffold files. This is
 * a structural repository check only. It does not inventory every published
 * example family or assess runtime behavior, content quality, operational
 * evidence, or production readiness.
 *
 * Usage:
 *   npm run check-health
 *   npm run check-health -- --category data-routing
 *   npm run check-health -- --format json
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ExampleScaffold {
  name: string;
  category: string;
  files: {
    stageFile: boolean;
    explorer: boolean;
    index: boolean;
    setup: boolean;
  };
  missingFiles: string[];
  fileCoveragePercent: number;
  status: 'structurally-complete' | 'partial' | 'minimal';
}

interface CategoryInventory {
  category: string;
  scaffoldCount: number;
  structurallyCompleteScaffolds: number;
  partialScaffolds: number;
  minimalScaffolds: number;
  averageFileCoverage: number;
}

interface ScaffoldInventory {
  scope: string;
  totalScaffolds: number;
  structurallyCompleteScaffolds: number;
  partialScaffolds: number;
  minimalScaffolds: number;
  overallFileCoverage: number;
  categories: CategoryInventory[];
  scaffolds: ExampleScaffold[];
}

const CATEGORIES = ['data-routing', 'data-security', 'data-transformation', 'log-processing'];

/**
 * Find all stage files and extract example names
 */
async function findExamples(): Promise<Map<string, string>> {
  const examples = new Map<string, string>(); // name -> category

  for (const category of CATEGORIES) {
    const pattern = `docs/${category}/*-full.stages.ts`;
    const files = await glob(pattern, { cwd: process.cwd() });

    for (const file of files) {
      const basename = path.basename(file, '-full.stages.ts');
      examples.set(basename, category);
    }
  }

  return examples;
}

/**
 * Check health of a single example
 */
function checkExampleScaffold(name: string, category: string): ExampleScaffold {
  const docsDir = path.join(process.cwd(), 'docs', category);
  const exampleDir = path.join(docsDir, name);

  const files = {
    stageFile: fs.existsSync(path.join(docsDir, `${name}-full.stages.ts`)),
    explorer: fs.existsSync(path.join(exampleDir, 'explorer.mdx')),
    index: fs.existsSync(path.join(exampleDir, 'index.mdx')),
    setup: fs.existsSync(path.join(exampleDir, 'setup.mdx')),
  };

  const missingFiles: string[] = [];
  if (!files.stageFile) missingFiles.push(`${name}-full.stages.ts`);
  if (!files.explorer) missingFiles.push(`${name}/explorer.mdx`);
  if (!files.index) missingFiles.push(`${name}/index.mdx`);
  if (!files.setup) missingFiles.push(`${name}/setup.mdx`);

  const fileCount = Object.values(files).filter(Boolean).length;
  const fileCoveragePercent = Math.round((fileCount / 4) * 100);

  let status: 'structurally-complete' | 'partial' | 'minimal';
  if (fileCoveragePercent === 100) {
    status = 'structurally-complete';
  } else if (fileCoveragePercent >= 50) {
    status = 'partial';
  } else {
    status = 'minimal';
  }

  return {
    name,
    category,
    files,
    missingFiles,
    fileCoveragePercent,
    status,
  };
}

/**
 * Generate category health summary
 */
function summarizeCategory(scaffolds: ExampleScaffold[], category: string): CategoryInventory {
  const categoryScaffolds = scaffolds.filter(e => e.category === category);
  const structurallyCompleteScaffolds = categoryScaffolds.filter(e => e.status === 'structurally-complete').length;
  const partialScaffolds = categoryScaffolds.filter(e => e.status === 'partial').length;
  const minimalScaffolds = categoryScaffolds.filter(e => e.status === 'minimal').length;

  const totalFileCoverage = categoryScaffolds.reduce((sum, e) => sum + e.fileCoveragePercent, 0);
  const averageFileCoverage = categoryScaffolds.length > 0
    ? Math.round(totalFileCoverage / categoryScaffolds.length)
    : 0;

  return {
    category,
    scaffoldCount: categoryScaffolds.length,
    structurallyCompleteScaffolds,
    partialScaffolds,
    minimalScaffolds,
    averageFileCoverage,
  };
}

/**
 * Generate full health report
 */
async function generateScaffoldInventory(categoryFilter?: string): Promise<ScaffoldInventory> {
  const exampleMap = await findExamples();
  const scaffolds: ExampleScaffold[] = [];

  for (const [name, category] of exampleMap.entries()) {
    if (categoryFilter && category !== categoryFilter) {
      continue;
    }
    scaffolds.push(checkExampleScaffold(name, category));
  }

  const structurallyCompleteScaffolds = scaffolds.filter(e => e.status === 'structurally-complete').length;
  const partialScaffolds = scaffolds.filter(e => e.status === 'partial').length;
  const minimalScaffolds = scaffolds.filter(e => e.status === 'minimal').length;

  const totalFileCoverage = scaffolds.reduce((sum, e) => sum + e.fileCoveragePercent, 0);
  const overallFileCoverage = scaffolds.length > 0
    ? Math.round(totalFileCoverage / scaffolds.length)
    : 0;

  const categories = CATEGORIES
    .filter(cat => !categoryFilter || cat === categoryFilter)
    .map(cat => summarizeCategory(scaffolds, cat))
    .filter(cat => cat.scaffoldCount > 0);

  return {
    scope: 'Stage-backed interactive scaffolds in data-routing, data-security, data-transformation, and log-processing',
    totalScaffolds: scaffolds.length,
    structurallyCompleteScaffolds,
    partialScaffolds,
    minimalScaffolds,
    overallFileCoverage,
    categories,
    scaffolds,
  };
}

/**
 * Print health report in human-readable format
 */
function printScaffoldInventory(report: ScaffoldInventory): void {
  console.log('\n📊 Interactive Scaffold Inventory\n');
  console.log('='.repeat(80));
  console.log('\nScope: stage-backed interactive scaffolds in four original categories.');
  console.log('This check verifies four required files only; it does not assess all published');
  console.log('examples, runtime behavior, content quality, or production readiness.');

  // Overall summary
  console.log('\n📈 Structural Statistics:');
  console.log(`   Total Scaffolds: ${report.totalScaffolds}`);
  console.log(`   ✅ Required Files Present: ${report.structurallyCompleteScaffolds}`);
  console.log(`   ⚠️  Partial File Sets (50-99%): ${report.partialScaffolds}`);
  console.log(`   ❌ Minimal File Sets (<50%): ${report.minimalScaffolds}`);
  console.log(`   📊 Average File Coverage: ${report.overallFileCoverage}%`);

  // Category breakdown
  console.log('\n📂 Category Breakdown:\n');
  for (const cat of report.categories) {
    const icon = cat.averageFileCoverage === 100 ? '✅' : cat.averageFileCoverage >= 75 ? '⚠️' : '❌';
    console.log(`${icon} ${cat.category}:`);
    console.log(`   Scaffolds: ${cat.scaffoldCount}`);
    console.log(`   Required files present: ${cat.structurallyCompleteScaffolds}, Partial: ${cat.partialScaffolds}, Minimal: ${cat.minimalScaffolds}`);
    console.log(`   Average file coverage: ${cat.averageFileCoverage}%`);
    console.log('');
  }

  // Detailed example status
  console.log('📋 Scaffold Details:\n');

  const grouped = new Map<string, ExampleScaffold[]>();
  for (const scaffold of report.scaffolds) {
    if (!grouped.has(scaffold.category)) {
      grouped.set(scaffold.category, []);
    }
    grouped.get(scaffold.category)!.push(scaffold);
  }

  for (const [category, examples] of grouped.entries()) {
    console.log(`\n${category}:`);
    for (const example of examples) {
      const statusIcon = example.status === 'structurally-complete' ? '✅' : example.status === 'partial' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${example.name} (${example.fileCoveragePercent}% of required files)`);

      if (example.missingFiles.length > 0) {
        console.log(`     Missing: ${example.missingFiles.join(', ')}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('');
}

/**
 * Print health report in JSON format
 */
function printJsonReport(report: ScaffoldInventory): void {
  console.log(JSON.stringify(report, null, 2));
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let categoryFilter: string | undefined;
  let format: 'text' | 'json' = 'text';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && i + 1 < args.length) {
      categoryFilter = args[i + 1];
      i++;
    } else if (args[i] === '--format' && i + 1 < args.length) {
      format = args[i + 1] as 'text' | 'json';
      i++;
    }
  }

  const report = await generateScaffoldInventory(categoryFilter);

  if (categoryFilter && !CATEGORIES.includes(categoryFilter)) {
    throw new Error(
      `Unknown category "${categoryFilter}". Expected one of: ${CATEGORIES.join(', ')}`
    );
  }

  if (format === 'json') {
    printJsonReport(report);
  } else {
    printScaffoldInventory(report);
  }

  // Enforce the structural contract for every discovered scaffold.
  if (
    report.totalScaffolds === 0 ||
    report.structurallyCompleteScaffolds < report.totalScaffolds
  ) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Health check failed:', error);
  process.exit(1);
});
