#!/usr/bin/env ts-node

/**
 * Interactive Scaffold File Coverage Report Generator
 *
 * Generates a markdown report showing:
 * - Required-file coverage for stage-backed interactive scaffolds
 * - Category-by-category breakdown
 * - Detailed missing files list
 * - Progress tracking over time
 *
 * Usage:
 *   npm run coverage-report
 * This report does not inventory every published example or assess runtime
 * behavior, content quality, operational evidence, or production readiness.
 *
 *   npm run coverage-report -- --output COVERAGE.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ExampleFiles {
  name: string;
  category: string;
  hasStageFile: boolean;
  hasExplorer: boolean;
  hasIndex: boolean;
  hasSetup: boolean;
  completionPercent: number;
}

const CATEGORIES = ['data-routing', 'data-security', 'data-transformation', 'log-processing'];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'data-routing': 'Circuit breakers, content routing, fan-out patterns, priority queues',
  'data-security': 'PII removal, encryption patterns, schema enforcement, data sanitization',
  'data-transformation': 'Time windows, deduplication, format conversion, data enrichment',
  'log-processing': 'Log filtering, parsing, enrichment, production pipelines',
};

function percentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/**
 * Find all examples across all categories
 */
async function findAllExamples(): Promise<ExampleFiles[]> {
  const examples: ExampleFiles[] = [];

  for (const category of CATEGORIES) {
    const pattern = `docs/${category}/*-full.stages.ts`;
    const files = await glob(pattern, { cwd: process.cwd() });

    for (const file of files) {
      const basename = path.basename(file, '-full.stages.ts');
      const exampleDir = path.join(process.cwd(), 'docs', category, basename);

      const hasStageFile = true; // We found it via glob
      const hasExplorer = fs.existsSync(path.join(exampleDir, 'explorer.mdx'));
      const hasIndex = fs.existsSync(path.join(exampleDir, 'index.mdx'));
      const hasSetup = fs.existsSync(path.join(exampleDir, 'setup.mdx'));

      const fileCount = [hasStageFile, hasExplorer, hasIndex, hasSetup].filter(Boolean).length;
      const completionPercent = Math.round((fileCount / 4) * 100);

      examples.push({
        name: basename,
        category,
        hasStageFile,
        hasExplorer,
        hasIndex,
        hasSetup,
        completionPercent,
      });
    }
  }

  return examples;
}

/**
 * Generate markdown coverage report
 */
function generateMarkdownReport(examples: ExampleFiles[]): string {
  const now = new Date().toISOString().split('T')[0];

  let md = `# Interactive Scaffold File Coverage\n\n`;
  md += `**Generated:** ${now}\n\n`;
  md += `> Scope: stage-backed interactive scaffolds in the four original categories. This checks four required repository files only; it does not assess all published examples, runtime behavior, content quality, or production readiness.\n\n`;
  md += `## Overview\n\n`;

  // Overall statistics
  const total = examples.length;
  const complete = examples.filter(e => e.completionPercent === 100).length;
  const partial = examples.filter(e => e.completionPercent >= 50 && e.completionPercent < 100).length;
  const minimal = examples.filter(e => e.completionPercent < 50).length;

  const totalCompletion = examples.reduce((sum, e) => sum + e.completionPercent, 0);
  const avgCompletion = total > 0 ? Math.round(totalCompletion / total) : 0;

  md += `- **Stage-backed scaffolds discovered:** ${total}\n`;
  md += `- **All required files present:** ${complete} (${percentage(complete, total)}%)\n`;
  md += `- **Partial file sets:** ${partial} (${percentage(partial, total)}%)\n`;
  md += `- **Minimal file sets:** ${minimal} (${percentage(minimal, total)}%)\n`;
  md += `- **Average required-file coverage:** ${avgCompletion}%\n\n`;

  // Progress bar
  const completeBar = '█'.repeat(Math.round(avgCompletion / 5));
  const incompleteBar = '░'.repeat(20 - Math.round(avgCompletion / 5));
  md += `\`\`\`\n${completeBar}${incompleteBar} ${avgCompletion}%\n\`\`\`\n\n`;

  // Category breakdown
  md += `## Category Breakdown\n\n`;

  for (const category of CATEGORIES) {
    const categoryExamples = examples.filter(e => e.category === category);

    if (categoryExamples.length === 0) {
      continue;
    }

    const catComplete = categoryExamples.filter(e => e.completionPercent === 100).length;
    const catTotal = categoryExamples.length;
    const catAvg = Math.round(
      categoryExamples.reduce((sum, e) => sum + e.completionPercent, 0) / catTotal
    );

    md += `### ${category}\n\n`;
    md += `${CATEGORY_DESCRIPTIONS[category]}\n\n`;
    md += `- **Scaffolds:** ${catTotal}\n`;
    md += `- **All required files present:** ${catComplete}/${catTotal} (${percentage(catComplete, catTotal)}%)\n`;
    md += `- **Average required-file coverage:** ${catAvg}%\n\n`;

    // Example table
    md += `| Scaffold | Stage File | Explorer | Index | Setup | File Coverage |\n`;
    md += `|---------|-----------|----------|-------|-------|------------|\n`;

    for (const example of categoryExamples) {
      const stageIcon = example.hasStageFile ? '✅' : '❌';
      const explorerIcon = example.hasExplorer ? '✅' : '❌';
      const indexIcon = example.hasIndex ? '✅' : '❌';
      const setupIcon = example.hasSetup ? '✅' : '❌';
      const completionIcon = example.completionPercent === 100 ? '✅' : example.completionPercent >= 50 ? '⚠️' : '❌';

      md += `| ${example.name} | ${stageIcon} | ${explorerIcon} | ${indexIcon} | ${setupIcon} | ${completionIcon} ${example.completionPercent}% |\n`;
    }

    md += `\n`;
  }

  // Missing files section
  const incompleteExamples = examples.filter(e => e.completionPercent < 100);

  if (incompleteExamples.length > 0) {
    md += `## Scaffolds Missing Required Files\n\n`;
    md += `The following discovered scaffolds need additional required files:\n\n`;

    for (const example of incompleteExamples) {
      md += `### ${example.category}/${example.name} (${example.completionPercent}%)\n\n`;

      const missing: string[] = [];
      if (!example.hasStageFile) missing.push('Stage file (*-full.stages.ts)');
      if (!example.hasExplorer) missing.push('Explorer page (explorer.mdx)');
      if (!example.hasIndex) missing.push('Index page (index.mdx)');
      if (!example.hasSetup) missing.push('Setup guide (setup.mdx)');

      if (missing.length > 0) {
        md += `**Missing files:**\n`;
        for (const file of missing) {
          md += `- ${file}\n`;
        }
        md += `\n`;
      }
    }
  }

  // Next steps
  md += `## Next Steps\n\n`;

  if (total === 0) {
    md += `❌ **No stage-backed interactive scaffolds were discovered.**\n\n`;
    md += `Check the stage-file paths and inventory configuration before treating this report as a release signal.\n`;
  } else if (complete === total) {
    md += `✅ **All discovered stage-backed scaffolds contain the four required files.**\n\n`;
    md += `This is structural coverage only; use the separate content, runtime, and operational-evidence reviews before making broader quality or readiness claims.\n`;
  } else {
    md += `To restore structural file coverage:\n\n`;

    const priorities = incompleteExamples
      .filter(e => e.completionPercent >= 50)
      .sort((a, b) => b.completionPercent - a.completionPercent);

    if (priorities.length > 0) {
      md += `### High Priority (>50% file coverage)\n\n`;
      for (const example of priorities.slice(0, 5)) {
        md += `- **${example.category}/${example.name}** (${example.completionPercent}%)\n`;
      }
      md += `\n`;
    }

    const needWork = incompleteExamples.filter(e => e.completionPercent < 50);
    if (needWork.length > 0) {
      md += `### Needs Significant Work (<50% file coverage)\n\n`;
      for (const example of needWork) {
        md += `- **${example.category}/${example.name}** (${example.completionPercent}%)\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n\n`;
  md += `*This report is automatically generated. Run \`npm run coverage-report\` to update.*\n`;

  return md;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && i + 1 < args.length) {
      outputPath = args[i + 1];
      i++;
    }
  }

  console.log('📊 Generating interactive scaffold file coverage report...\n');

  const examples = await findAllExamples();
  const report = generateMarkdownReport(examples);

  if (outputPath) {
    const fullPath = path.join(process.cwd(), outputPath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, report);
    console.log(`✅ Coverage report written to: ${outputPath}`);
  } else {
    console.log(report);
  }

  console.log('');
}

main().catch(error => {
  console.error('❌ Coverage report generation failed:', error);
  process.exit(1);
});
