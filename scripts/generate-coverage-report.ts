#!/usr/bin/env ts-node

/**
 * Example Coverage Report Generator
 *
 * Generates a markdown report showing:
 * - Overall example coverage statistics
 * - Category-by-category breakdown
 * - Detailed missing files list
 * - Progress tracking over time
 *
 * Usage:
 *   npm run coverage-report
 *   npm run coverage-report -- --output docs/internal/COVERAGE.md
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

  let md = `# Example Coverage Report\n\n`;
  md += `**Generated:** ${now}\n\n`;
  md += `## Overview\n\n`;

  // Overall statistics
  const total = examples.length;
  const complete = examples.filter(e => e.completionPercent === 100).length;
  const partial = examples.filter(e => e.completionPercent >= 50 && e.completionPercent < 100).length;
  const minimal = examples.filter(e => e.completionPercent < 50).length;

  const totalCompletion = examples.reduce((sum, e) => sum + e.completionPercent, 0);
  const avgCompletion = total > 0 ? Math.round(totalCompletion / total) : 0;

  md += `- **Total Examples:** ${total}\n`;
  md += `- **Complete Examples:** ${complete} (${Math.round((complete / total) * 100)}%)\n`;
  md += `- **Partial Examples:** ${partial} (${Math.round((partial / total) * 100)}%)\n`;
  md += `- **Minimal Examples:** ${minimal} (${Math.round((minimal / total) * 100)}%)\n`;
  md += `- **Average Completion:** ${avgCompletion}%\n\n`;

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
    md += `- **Examples:** ${catTotal}\n`;
    md += `- **Complete:** ${catComplete}/${catTotal} (${Math.round((catComplete / catTotal) * 100)}%)\n`;
    md += `- **Average Completion:** ${catAvg}%\n\n`;

    // Example table
    md += `| Example | Stage File | Explorer | Index | Setup | Completion |\n`;
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
    md += `## Incomplete Examples\n\n`;
    md += `The following examples need additional files:\n\n`;

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

  if (complete === total) {
    md += `🎉 **All examples are complete!** Great work!\n\n`;
    md += `Consider:\n`;
    md += `- Adding more examples to cover additional use cases\n`;
    md += `- Improving existing examples with more detailed tutorials\n`;
    md += `- Creating cross-references between related examples\n`;
  } else {
    md += `To improve coverage:\n\n`;

    const priorities = incompleteExamples
      .filter(e => e.completionPercent >= 50)
      .sort((a, b) => b.completionPercent - a.completionPercent);

    if (priorities.length > 0) {
      md += `### High Priority (>50% complete)\n\n`;
      for (const example of priorities.slice(0, 5)) {
        md += `- **${example.category}/${example.name}** (${example.completionPercent}%)\n`;
      }
      md += `\n`;
    }

    const needWork = incompleteExamples.filter(e => e.completionPercent < 50);
    if (needWork.length > 0) {
      md += `### Needs Significant Work (<50% complete)\n\n`;
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

  console.log('📊 Generating example coverage report...\n');

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
