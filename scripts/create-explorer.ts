#!/usr/bin/env ts-node

/**
 * CLI tool to generate interactive explorer boilerplate
 *
 * Usage:
 *   npm run create-explorer -- --name "my-example" --category "data-routing" --stages 4 --title "My Example Title"
 *
 * Generates:
 *   - docs/{category}/{name}-full.stages.ts
 *   - docs/{category}/{name}/explorer.mdx
 *   - Updates sidebars.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ExplorerConfig {
  name: string;
  category: string;
  stages: number;
  title: string;
}

function parseArgs(): ExplorerConfig {
  const args = process.argv.slice(2);
  const config: Partial<ExplorerConfig> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key === 'stages') {
      config[key] = parseInt(value, 10);
    } else {
      config[key] = value;
    }
  }

  if (!config.name || !config.category || !config.stages || !config.title) {
    console.error('Usage: npm run create-explorer -- --name <name> --category <category> --stages <number> --title <title>');
    console.error('\nExample:');
    console.error('  npm run create-explorer -- --name "circuit-breakers" --category "data-routing" --stages 4 --title "Circuit Breaker Patterns"');
    process.exit(1);
  }

  return config as ExplorerConfig;
}

function generateStagesFile(config: ExplorerConfig): string {
  const exportName = config.name.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('') + 'Stages';

  let content = `import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * ${config.stages}-Stage ${config.title} Pipeline
 * TODO: Add description of what this pipeline demonstrates
 */

export const ${exportName}: Stage[] = [\n`;

  for (let i = 1; i <= config.stages; i++) {
    content += `  // ============================================================================
  // STAGE ${i}: TODO - Add stage title
  // ============================================================================
  {
    id: ${i},
    title: 'Stage ${i} Title',
    description: 'TODO: Describe what happens in this stage',
    yamlFilename: 'step-${i - 1}-description.yaml',
    yamlCode: \`# TODO: Add YAML configuration
pipeline:
  processors:
    - mapping: |
        root = this
        # Add your transformation here\`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"field": "value",', indent: 1, key: 'field', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"field": "value",', indent: 1, key: 'field', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },\n`;
  }

  content += '];\n';
  return content;
}

function generateExplorerMdx(config: ExplorerConfig): string {
  const exportName = config.name.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('') + 'Stages';

  return `---
title: Interactive ${config.title} Explorer
sidebar_label: Interactive Explorer
sidebar_position: 2
description: Explore ${config.stages} stages of ${config.title.toLowerCase()} with live before/after comparisons
keywords: [${config.name}, interactive, pipeline, expanso]
---

import DataPipelineExplorer from '@site/src/components/DataPipelineExplorer';
import { ${exportName} } from '../${config.name}-full.stages';

# Interactive ${config.title} Explorer

**See ${config.title.toLowerCase()} in action!** Use the interactive explorer below to step through ${config.stages} stages. Watch how data transforms at each step.

## How to Use This Explorer

1. **Navigate** using arrow keys (← →) or click the numbered stage buttons
2. **Compare** the Input (left) and Output (right) showing transformations
3. **Observe** how data changes at each stage
4. **Inspect** the YAML code showing the pipeline configuration
5. **Learn** from the stage description explaining each step

## Interactive ${config.title} Explorer

<DataPipelineExplorer
  stages={${exportName}}
  title="${config.title.toUpperCase()}"
  subtitle="${config.stages}-Stage Implementation"
/>

## Understanding the Stages

### Stage 1: TODO
TODO: Describe first stage

### Stage 2: TODO
TODO: Describe second stage

## What You've Learned

After exploring all ${config.stages} stages, you now understand:

✅ **TODO** - Add learning outcome 1

✅ **TODO** - Add learning outcome 2

✅ **TODO** - Add learning outcome 3

## Try It Yourself

Ready to build your own ${config.title.toLowerCase()} pipeline? Follow the step-by-step tutorial:

<div style={{display: 'flex', gap: '1.5rem', marginTop: '2rem', marginBottom: '3rem', flexWrap: 'wrap', justifyContent: 'flex-start'}}>
  <a href="./setup" className="button button--primary button--lg" style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', borderRadius: '8px', padding: '1rem 2rem', fontWeight: '600', minWidth: '240px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'all 0.2s ease'}}>
    Start Tutorial
  </a>
  <a href="./complete-pipeline" className="button button--secondary button--lg" style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', borderRadius: '8px', padding: '1rem 2rem', fontWeight: '600', minWidth: '240px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'all 0.2s ease'}}>
    Download Complete Solution
  </a>
</div>

## Deep Dive into Each Step

Want to understand each technique in depth?

- [**Step 1: TODO**](./step-1-todo) - Description
- [**Step 2: TODO**](./step-2-todo) - Description

## Common Questions

### Question 1?
TODO: Answer common question about this pattern.

### Question 2?
TODO: Answer another common question.

---

**Next:** [Set up your environment](./setup) to build ${config.title.toLowerCase()} pipelines yourself
`;
}

function updateSidebars(config: ExplorerConfig): void {
  const sidebarsPath = path.join(process.cwd(), 'sidebars.ts');
  let content = fs.readFileSync(sidebarsPath, 'utf8');

  const categoryMap: Record<string, string> = {
    'data-routing': 'Data Routing',
    'data-security': 'Data Security',
    'data-transformation': 'Data Transformation',
    'log-processing': 'Log Processing',
  };

  const categoryLabel = categoryMap[config.category];
  if (!categoryLabel) {
    console.warn(`Warning: Unknown category ${config.category}, sidebar not updated`);
    return;
  }

  // Find the category section
  const categoryRegex = new RegExp(`label: '${categoryLabel}',[\\s\\S]*?items: \\[([\\s\\S]*?)\\],\\s*\\},`, 'm');
  const match = content.match(categoryRegex);

  if (match) {
    const itemsSection = match[1];
    const newEntry = `        {
          type: 'category',
          label: '${config.title}',
          collapsible: true,
          collapsed: true,
          items: [
            '${config.category}/${config.name}/index',
            '${config.category}/${config.name}/explorer',
          ],
        },`;

    // Add the new entry at the end of the items array
    const updatedItems = itemsSection.trim() + '\n' + newEntry;
    const updatedContent = content.replace(itemsSection, '\n' + updatedItems + '\n      ');

    fs.writeFileSync(sidebarsPath, updatedContent);
    console.log('✅ Updated sidebars.ts');
  } else {
    console.warn(`Warning: Could not find category section for ${categoryLabel}`);
  }
}

function main(): void {
  const config = parseArgs();

  console.log('🚀 Creating interactive explorer...');
  console.log(`   Name: ${config.name}`);
  console.log(`   Category: ${config.category}`);
  console.log(`   Stages: ${config.stages}`);
  console.log(`   Title: ${config.title}`);
  console.log('');

  // Create directories
  const docsDir = path.join(process.cwd(), 'docs', config.category);
  const explorerDir = path.join(docsDir, config.name);

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  if (!fs.existsSync(explorerDir)) {
    fs.mkdirSync(explorerDir, { recursive: true });
  }

  // Generate files
  const stagesFile = path.join(docsDir, `${config.name}-full.stages.ts`);
  const explorerFile = path.join(explorerDir, 'explorer.mdx');

  if (fs.existsSync(stagesFile)) {
    console.error(`❌ Error: ${stagesFile} already exists`);
    process.exit(1);
  }

  if (fs.existsSync(explorerFile)) {
    console.error(`❌ Error: ${explorerFile} already exists`);
    process.exit(1);
  }

  fs.writeFileSync(stagesFile, generateStagesFile(config));
  console.log(`✅ Created ${stagesFile}`);

  fs.writeFileSync(explorerFile, generateExplorerMdx(config));
  console.log(`✅ Created ${explorerFile}`);

  // Update sidebars
  updateSidebars(config);

  console.log('');
  console.log('🎉 Explorer boilerplate created successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit the stages file to add your pipeline logic');
  console.log('  2. Update the explorer.mdx with descriptions');
  console.log(`  3. Create ${config.name}/index.mdx for the introduction page`);
  console.log('  4. Run `npm start` to preview your explorer');
  console.log('');
}

main();
