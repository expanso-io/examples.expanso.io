#!/usr/bin/env ts-node

/**
 * Example Health Check Script
 *
 * Analyzes all interactive examples and reports completion status:
 * - Which examples exist in each category
 * - What files each example has (stage file, explorer, index, setup)
 * - Completion percentage for each example
 * - Overall health metrics
 *
 * Usage:
 *   npm run check-health
 *   npm run check-health -- --category data-routing
 *   npm run check-health -- --format json
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ExampleHealth {
  name: string;
  category: string;
  files: {
    stageFile: boolean;
    explorer: boolean;
    index: boolean;
    setup: boolean;
  };
  missingFiles: string[];
  completionPercent: number;
  status: 'complete' | 'partial' | 'minimal';
}

interface CategoryHealth {
  category: string;
  exampleCount: number;
  completeExamples: number;
  partialExamples: number;
  minimalExamples: number;
  averageCompletion: number;
}

interface HealthReport {
  totalExamples: number;
  completeExamples: number;
  partialExamples: number;
  minimalExamples: number;
  overallCompletion: number;
  categories: CategoryHealth[];
  examples: ExampleHealth[];
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
function checkExampleHealth(name: string, category: string): ExampleHealth {
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
  const completionPercent = Math.round((fileCount / 4) * 100);

  let status: 'complete' | 'partial' | 'minimal';
  if (completionPercent === 100) {
    status = 'complete';
  } else if (completionPercent >= 50) {
    status = 'partial';
  } else {
    status = 'minimal';
  }

  return {
    name,
    category,
    files,
    missingFiles,
    completionPercent,
    status,
  };
}

/**
 * Generate category health summary
 */
function summarizeCategory(examples: ExampleHealth[], category: string): CategoryHealth {
  const categoryExamples = examples.filter(e => e.category === category);
  const completeExamples = categoryExamples.filter(e => e.status === 'complete').length;
  const partialExamples = categoryExamples.filter(e => e.status === 'partial').length;
  const minimalExamples = categoryExamples.filter(e => e.status === 'minimal').length;

  const totalCompletion = categoryExamples.reduce((sum, e) => sum + e.completionPercent, 0);
  const averageCompletion = categoryExamples.length > 0
    ? Math.round(totalCompletion / categoryExamples.length)
    : 0;

  return {
    category,
    exampleCount: categoryExamples.length,
    completeExamples,
    partialExamples,
    minimalExamples,
    averageCompletion,
  };
}

/**
 * Generate full health report
 */
async function generateHealthReport(categoryFilter?: string): Promise<HealthReport> {
  const exampleMap = await findExamples();
  const examples: ExampleHealth[] = [];

  for (const [name, category] of exampleMap.entries()) {
    if (categoryFilter && category !== categoryFilter) {
      continue;
    }
    examples.push(checkExampleHealth(name, category));
  }

  const completeExamples = examples.filter(e => e.status === 'complete').length;
  const partialExamples = examples.filter(e => e.status === 'partial').length;
  const minimalExamples = examples.filter(e => e.status === 'minimal').length;

  const totalCompletion = examples.reduce((sum, e) => sum + e.completionPercent, 0);
  const overallCompletion = examples.length > 0
    ? Math.round(totalCompletion / examples.length)
    : 0;

  const categories = CATEGORIES
    .filter(cat => !categoryFilter || cat === categoryFilter)
    .map(cat => summarizeCategory(examples, cat))
    .filter(cat => cat.exampleCount > 0);

  return {
    totalExamples: examples.length,
    completeExamples,
    partialExamples,
    minimalExamples,
    overallCompletion,
    categories,
    examples,
  };
}

/**
 * Print health report in human-readable format
 */
function printHealthReport(report: HealthReport): void {
  console.log('\n📊 Example Health Report\n');
  console.log('='.repeat(80));

  // Overall summary
  console.log('\n📈 Overall Statistics:');
  console.log(`   Total Examples: ${report.totalExamples}`);
  console.log(`   ✅ Complete (100%): ${report.completeExamples}`);
  console.log(`   ⚠️  Partial (50-99%): ${report.partialExamples}`);
  console.log(`   ❌ Minimal (<50%): ${report.minimalExamples}`);
  console.log(`   📊 Average Completion: ${report.overallCompletion}%`);

  // Category breakdown
  console.log('\n📂 Category Breakdown:\n');
  for (const cat of report.categories) {
    const icon = cat.averageCompletion === 100 ? '✅' : cat.averageCompletion >= 75 ? '⚠️' : '❌';
    console.log(`${icon} ${cat.category}:`);
    console.log(`   Examples: ${cat.exampleCount}`);
    console.log(`   Complete: ${cat.completeExamples}, Partial: ${cat.partialExamples}, Minimal: ${cat.minimalExamples}`);
    console.log(`   Average Completion: ${cat.averageCompletion}%`);
    console.log('');
  }

  // Detailed example status
  console.log('📋 Example Details:\n');

  const grouped = new Map<string, ExampleHealth[]>();
  for (const example of report.examples) {
    if (!grouped.has(example.category)) {
      grouped.set(example.category, []);
    }
    grouped.get(example.category)!.push(example);
  }

  for (const [category, examples] of grouped.entries()) {
    console.log(`\n${category}:`);
    for (const example of examples) {
      const statusIcon = example.status === 'complete' ? '✅' : example.status === 'partial' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${example.name} (${example.completionPercent}%)`);

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
function printJsonReport(report: HealthReport): void {
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

  const report = await generateHealthReport(categoryFilter);

  if (format === 'json') {
    printJsonReport(report);
  } else {
    printHealthReport(report);
  }

  // Exit with error code if there are incomplete examples
  if (report.completeExamples < report.totalExamples) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Health check failed:', error);
  process.exit(1);
});
